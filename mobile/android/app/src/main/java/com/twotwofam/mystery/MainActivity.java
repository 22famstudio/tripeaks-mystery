package com.twotwofam.mystery;

import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

// 온천 여관의 비밀 — 웹 게임(www/)을 띄우는 화면.
// 가로 고정(AndroidManifest screenOrientation)에 더해 상태바 · 내비게이션 바를 숨긴 전체 화면으로 실행하고,
// 플레이 중 화면이 꺼지지 않게 한다.
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayGamesSavesPlugin.class);   // 앱 안 플러그인: Play 게임즈 저장된 게임 (js/play-games-sync.js)
        super.onCreate(savedInstanceState);
        // WebView 그래픽 메모리(타일) 예산: 기본값은 '화면에 보이는 영역'으로 계산되는데, 전체 화면(몰입 모드) · 일부 기기
        // (Exynos 갤럭시 등)에서 그 값이 비정상적으로 작게 잡혀 'tile memory limits exceeded' → 카드 · 덱 · 화면 전체가 하얗게
        // 깜빡였다. 미리 그리기를 켜면 WebView 크기 전체로 예산을 잡는다.
        getBridge().getWebView().getSettings().setOffscreenPreRaster(true);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        enterFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterFullscreen();   // 알림창 등을 내렸다 올린 뒤 다시 숨김
    }

    private void enterFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
