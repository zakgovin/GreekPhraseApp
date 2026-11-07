package com.zakgovin.greekphraseapp;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognitionSupport;
import android.speech.RecognitionSupportCallback;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import androidx.annotation.RequiresApi;
import androidx.lifecycle.Lifecycle;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "FrasiSpeech", permissions = @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }))
public class FrasiSpeechPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer active;
    private PluginCall activeCall;
    private String activeId;

    private Intent greekIntent() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "el-GR");
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        return intent;
    }

    private void unavailable(PluginCall call, String reason) {
        JSObject value = new JSObject(); value.put("available", false); value.put("reason", reason); call.resolve(value);
    }

    @PluginMethod
    public void status(PluginCall call) {
        main.post(() -> {
            if (Build.VERSION.SDK_INT < 33) {
                unavailable(call, "Голосовой ответ доступен на Android 13+ при установленных данных распознавания греческого.");
                return;
            }
            if (!SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())) {
                unavailable(call, "На устройстве нет локального распознавания речи. Задания со словами доступны полностью.");
                return;
            }
            checkGreekSupport(call);
        });
    }

    @RequiresApi(33)
    private void checkGreekSupport(PluginCall call) {
        AtomicBoolean done = new AtomicBoolean(false);
        SpeechRecognizer checker;
        try { checker = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext()); }
        catch (Exception error) { unavailable(call, "Не удалось подключить распознавание речи Android."); return; }
        main.postDelayed(() -> {
            if (!done.compareAndSet(false, true)) return;
            checker.destroy(); unavailable(call, "Не удалось проверить греческое распознавание на устройстве.");
        }, 4000);
        try {
            checker.checkRecognitionSupport(greekIntent(), getContext().getMainExecutor(), new RecognitionSupportCallback() {
                @Override public void onSupportResult(RecognitionSupport support) {
                    if (!done.compareAndSet(false, true)) return;
                    boolean installed = false;
                    for (String language : support.getInstalledOnDeviceLanguages()) {
                        if (language.toLowerCase(java.util.Locale.ROOT).startsWith("el")) installed = true;
                    }
                    checker.destroy();
                    JSObject value = new JSObject(); value.put("available", installed);
                    value.put("reason", installed ? "" : "Для голосового ответа установите греческие данные распознавания в настройках Android.");
                    call.resolve(value);
                }
                @Override public void onError(int error) {
                    if (!done.compareAndSet(false, true)) return;
                    checker.destroy(); unavailable(call, "Греческое распознавание на устройстве пока недоступно.");
                }
            });
        } catch (Exception error) {
            if (done.compareAndSet(false, true)) { checker.destroy(); unavailable(call, "Греческое распознавание на устройстве пока недоступно."); }
        }
    }

    @PluginMethod
    public void listen(PluginCall call) {
        main.post(() -> {
            if (getPermissionState("microphone") != PermissionState.GRANTED) {
                requestPermissionForAlias("microphone", call, "microphoneResult");
            } else begin(call);
        });
    }
    @PermissionCallback
    private void microphoneResult(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) main.post(() -> begin(call));
        else call.reject("Разрешите доступ к микрофону или ответьте словами на экране.", "PERMISSION_DENIED");
    }

    private void begin(PluginCall call) {
        if (Build.VERSION.SDK_INT < 31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())) {
            call.reject("На устройстве нет локального распознавания греческого.", "UNAVAILABLE"); return;
        }
        if (!getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)) {
            call.reject("Голосовой ответ отменён.", "CANCELLED"); return;
        }
        cancelActive();
        String id = call.getString("id");
        if (id == null || id.length() > 100) { call.reject("Неизвестная попытка.", "INVALID_REQUEST"); return; }
        activeCall = call; activeId = id;
        try {
            SpeechRecognizer recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
            active = recognizer;
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float rmsdB) { }
                @Override public void onBufferReceived(byte[] buffer) { }
                @Override public void onEndOfSpeech() { }
                @Override public void onPartialResults(Bundle partialResults) { }
                @Override public void onEvent(int eventType, Bundle params) { }
                @Override public void onError(int error) {
                    if (active != recognizer) return;
                    PluginCall pending = activeCall; release();
                    String reason = error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED || error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE
                        ? "Греческие данные распознавания недоступны. Можно ответить словами на экране."
                        : "Не удалось разобрать речь. Попробуйте ещё раз или ответьте словами на экране.";
                    if (pending != null) pending.reject(reason, "RECOGNITION_ERROR");
                }
                @Override public void onResults(Bundle results) {
                    if (active != recognizer) return;
                    ArrayList<String> candidates = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    PluginCall pending = activeCall; release();
                    if (pending == null) return;
                    if (candidates == null || candidates.isEmpty() || candidates.get(0).trim().isEmpty()) {
                        pending.reject("Не удалось разобрать речь. Попробуйте ещё раз.", "NO_MATCH"); return;
                    }
                    JSObject value = new JSObject(); value.put("text", candidates.get(0)); value.put("alternatives", new JSArray(candidates)); pending.resolve(value);
                }
            });
            recognizer.startListening(greekIntent());
            main.postDelayed(() -> {
                if (active != recognizer) return;
                PluginCall pending = activeCall; release();
                if (pending != null) pending.reject("Не удалось закончить распознавание. Попробуйте ещё раз.", "TIMEOUT");
            }, 20000);
        } catch (Exception error) {
            release(); call.reject("Не удалось начать распознавание. Можно ответить словами на экране.", "UNAVAILABLE");
        }
    }
    private void release() {
        SpeechRecognizer current = active;
        active = null; activeCall = null; activeId = null;
        if (current != null) current.destroy();
    }
    private void cancelActive() {
        PluginCall pending = activeCall;
        if (active != null) active.cancel();
        release();
        if (pending != null) pending.reject("Голосовой ответ отменён.", "CANCELLED");
    }
    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> { if (active != null && activeId != null && activeId.equals(call.getString("id"))) active.stopListening(); call.resolve(); });
    }
    @PluginMethod
    public void cancel(PluginCall call) {
        main.post(() -> { if (activeId != null && activeId.equals(call.getString("id"))) cancelActive(); call.resolve(); });
    }
    @PluginMethod
    public void openSettings(PluginCall call) {
        main.post(() -> {
            try { getActivity().startActivity(new Intent(android.provider.Settings.ACTION_VOICE_INPUT_SETTINGS)); call.resolve(); }
            catch (Exception error) { call.reject("Откройте настройки голосового ввода Android.", "UNAVAILABLE"); }
        });
    }
    @Override protected void handleOnPause() { super.handleOnPause(); main.post(this::cancelActive); }
    @Override protected void handleOnDestroy() { main.post(this::cancelActive); super.handleOnDestroy(); }
}
