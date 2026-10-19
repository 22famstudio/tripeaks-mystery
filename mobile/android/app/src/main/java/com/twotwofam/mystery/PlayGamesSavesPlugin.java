package com.twotwofam.mystery;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.AuthenticationResult;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadata;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;
import com.google.android.gms.tasks.Task;

import java.nio.charset.StandardCharsets;

/**
 * Google Play 게임즈 '저장된 게임(스냅샷)' — js/play-games-sync.js 가 부른다.
 *
 * Google 공식 play-services-games-v2 를 그대로 쓰는 앱 안 플러그인. Capacitor 7 용으로 저장된 게임을 지원하는
 * 관리되는 커뮤니티 플러그인이 없어 직접 둔다.
 *
 * 설정 전 안전장치: res/values/games_ids.xml 의 game_services_project_id 가 비어 있으면 SDK 를 초기화하지 않고
 * isAvailable() 이 false 를 돌려준다 (Play Console 게임 서비스 프로젝트를 만들기 전 빌드도 그대로 동작).
 *
 * 기기끼리 충돌(두 기기에서 따로 저장)하면 RESOLUTION_POLICY_HIGHEST_PROGRESS — 진행도(progress)가 높은 쪽이 남는다.
 */
@CapacitorPlugin(name = "PlayGamesSaves")
public class PlayGamesSavesPlugin extends Plugin {
    private static final int POLICY = SnapshotsClient.RESOLUTION_POLICY_HIGHEST_PROGRESS;
    private boolean configured = false;

    @Override
    public void load() {
        String projectId = getContext().getString(R.string.game_services_project_id);
        if (projectId != null && !projectId.trim().isEmpty()) {
            PlayGamesSdk.initialize(getContext());
            configured = true;
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", configured);
        call.resolve(r);
    }

    /** interactive=false: 자동 로그인 확인만 · true: 로그인 창을 띄움 */
    @PluginMethod
    public void signIn(PluginCall call) {
        if (!configured) { call.reject("Play 게임즈 서비스가 설정되지 않았어요", "UNAVAILABLE"); return; }
        GamesSignInClient client = PlayGames.getGamesSignInClient(getActivity());
        Task<AuthenticationResult> task = Boolean.TRUE.equals(call.getBoolean("interactive", false)) ? client.signIn() : client.isAuthenticated();
        task.addOnCompleteListener(t -> {
            JSObject r = new JSObject();
            r.put("authenticated", t.isSuccessful() && t.getResult() != null && t.getResult().isAuthenticated());
            call.resolve(r);
        });
    }

    /** 스냅샷 읽기 → { exists, data, modifiedAt, progress } */
    @PluginMethod
    public void load(PluginCall call) {
        if (!configured) { call.reject("Play 게임즈 서비스가 설정되지 않았어요", "UNAVAILABLE"); return; }
        String name = call.getString("name", "save_data");
        SnapshotsClient snapshots = PlayGames.getSnapshotsClient(getActivity());
        snapshots.open(name, true, POLICY)
            .addOnSuccessListener(result -> {
                Snapshot snapshot = result.isConflict() ? result.getConflict().getSnapshot() : result.getData();
                if (snapshot == null) { call.reject("스냅샷을 열지 못했어요", "OPEN_FAILED"); return; }
                try {
                    byte[] bytes = snapshot.getSnapshotContents().readFully();
                    SnapshotMetadata meta = snapshot.getMetadata();
                    JSObject r = new JSObject();
                    r.put("exists", bytes != null && bytes.length > 0);
                    r.put("data", bytes == null ? "" : new String(bytes, StandardCharsets.UTF_8));
                    r.put("modifiedAt", meta.getLastModifiedTimestamp());
                    r.put("progress", meta.getProgressValue());
                    call.resolve(r);
                } catch (Exception e) {
                    call.reject("스냅샷을 읽지 못했어요", "READ_FAILED", e);
                } finally {
                    snapshots.discardAndClose(snapshot);
                }
            })
            .addOnFailureListener(e -> call.reject(e.getMessage(), "OPEN_FAILED", e));
    }

    /** 스냅샷 쓰기 { name, data, description, progress, playedTimeMillis } */
    @PluginMethod
    public void save(PluginCall call) {
        if (!configured) { call.reject("Play 게임즈 서비스가 설정되지 않았어요", "UNAVAILABLE"); return; }
        String name = call.getString("name", "save_data");
        String data = call.getString("data", "");
        String description = call.getString("description", "");
        Long progress = call.getLong("progress", 0L);
        Long played = call.getLong("playedTimeMillis", 0L);
        SnapshotsClient snapshots = PlayGames.getSnapshotsClient(getActivity());
        snapshots.open(name, true, POLICY)
            .addOnSuccessListener(result -> {
                Snapshot snapshot = result.isConflict() ? result.getConflict().getSnapshot() : result.getData();
                if (snapshot == null) { call.reject("스냅샷을 열지 못했어요", "OPEN_FAILED"); return; }
                snapshot.getSnapshotContents().writeBytes(data.getBytes(StandardCharsets.UTF_8));
                SnapshotMetadataChange.Builder change = new SnapshotMetadataChange.Builder()
                    .setDescription(description)
                    .setProgressValue(progress == null ? 0L : progress);
                if (played != null && played > 0) change.setPlayedTimeMillis(played);
                snapshots.commitAndClose(snapshot, change.build())
                    .addOnSuccessListener(meta -> {
                        JSObject r = new JSObject();
                        r.put("modifiedAt", meta.getLastModifiedTimestamp());
                        call.resolve(r);
                    })
                    .addOnFailureListener(e -> call.reject(e.getMessage(), "COMMIT_FAILED", e));
            })
            .addOnFailureListener(e -> call.reject(e.getMessage(), "OPEN_FAILED", e));
    }
}
