package com.zakgovin.greekphraseapp;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.OpenableColumns;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "FrasiNative",
    permissions = @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
)
public class FrasiNativePlugin extends Plugin {
    private static final int MAX_JSON_BYTES = 10_000_000;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ArrayList<Runnable> speechWaiters = new ArrayList<>();
    private TextToSpeech speech;
    private boolean speechStarting = false;
    private boolean speechComplete = false;
    private boolean speechReady = false;

    private MediaRecorder recorder;
    private File pendingRecording;
    private String activeRecordingKey;
    private long recordingStartedAt;

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences("frasi", 0);
    }

    @PluginMethod
    public void readProgress(PluginCall call) {
        JSObject result = new JSObject();
        result.put("content", preferences().getString("progress", null));
        call.resolve(result);
    }

    @PluginMethod
    public void saveProgress(PluginCall call) {
        String content = call.getString("content");
        try {
            if (content == null || content.getBytes(StandardCharsets.UTF_8).length > MAX_JSON_BYTES) {
                call.reject("Некорректный размер прогресса", "INVALID_PROGRESS");
                return;
            }
            JSONObject object = new JSONObject(content);
            if (object.optInt("version") != 1 || !object.has("memory") || !object.has("reviews")) {
                call.reject("Неизвестный формат прогресса", "INVALID_PROGRESS");
                return;
            }
            if (!preferences().edit().putString("progress", content).commit()) {
                call.reject("Не удалось сохранить прогресс", "STORAGE_ERROR");
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Не удалось сохранить прогресс", "STORAGE_ERROR");
        }
    }

    @PluginMethod
    public void preserveRecovery(PluginCall call) {
        String content = call.getString("content");
        try {
            if (content == null || content.getBytes(StandardCharsets.UTF_8).length > MAX_JSON_BYTES) {
                call.reject("Некорректный размер копии", "INVALID_PROGRESS");
                return;
            }
            File dir = new File(getContext().getFilesDir(), "recovery");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException();
            File backup = new File(dir, "progress-" + System.currentTimeMillis() + ".json");
            Files.write(backup.toPath(), content.getBytes(StandardCharsets.UTF_8));
            call.resolve();
        } catch (Exception error) {
            call.reject("Не удалось сохранить восстановимую копию", "STORAGE_ERROR");
        }
    }

    private void ensureSpeech(Runnable callback) {
        if (speechComplete) {
            callback.run();
            return;
        }
        speechWaiters.add(callback);
        if (speechStarting) return;
        speechStarting = true;
        speech = new TextToSpeech(getContext(), status -> main.post(() -> {
            speechReady = status == TextToSpeech.SUCCESS;
            speechComplete = true;
            speechStarting = false;
            if (speechReady) {
                speech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { }
                    @Override public void onDone(String id) { finishedSpeech(id, false); }
                    @Override public void onError(String id) { finishedSpeech(id, true); }
                    @Override public void onStop(String id, boolean interrupted) { finishedSpeech(id, false); }
                });
            }
            ArrayList<Runnable> waiting = new ArrayList<>(speechWaiters);
            speechWaiters.clear();
            for (Runnable action : waiting) action.run();
        }));
        main.postDelayed(() -> {
            if (speechComplete) return;
            speechComplete = true;
            speechStarting = false;
            speechReady = false;
            ArrayList<Runnable> waiting = new ArrayList<>(speechWaiters);
            speechWaiters.clear();
            for (Runnable action : waiting) action.run();
        }, 8000);
    }

    private void finishedSpeech(String id, boolean failed) {
        JSObject event = new JSObject();
        event.put("id", id);
        event.put("failed", failed);
        notifyListeners("speechFinished", event);
    }

    private Voice greekVoice() {
        if (!speechReady || speech == null) return null;
        try {
            Set<Voice> voices = speech.getVoices();
            if (voices == null) return null;
            Voice best = null;
            for (Voice voice : voices) {
                String language = voice.getLocale().getLanguage();
                if (!language.equals("el") && !language.equals("ell")) continue;
                if (voice.isNetworkConnectionRequired()) continue;
                if (voice.getFeatures() != null &&
                    voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                if (best == null || voice.getQuality() > best.getQuality()) best = voice;
            }
            return best;
        } catch (Exception error) {
            return null;
        }
    }

    @PluginMethod
    public void speechStatus(PluginCall call) {
        main.post(() -> {
            if (speechComplete && !speechReady && !speechStarting) {
                if (speech != null) speech.shutdown();
                speechComplete = false;
                speech = null;
            }
            ensureSpeech(() -> {
                Voice voice = greekVoice();
                JSObject result = new JSObject();
                result.put("available", voice != null);
                result.put("engineAvailable", speechReady);
                result.put("voice", voice == null ? "" : voice.getName());
                result.put("reason", voice != null ? "" :
                    speechReady ? "Установите греческий офлайн-голос в настройках озвучивания Android." :
                    "На устройстве не настроен движок озвучивания Android.");
                call.resolve(result);
            });
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text");
        String id = call.getString("id", UUID.randomUUID().toString());
        Double rate = call.getDouble("rate", 0.85);
        if (text == null || text.trim().isEmpty() || text.length() > 10000) {
            call.reject("Некорректный текст", "INVALID_TEXT");
            return;
        }
        main.post(() -> ensureSpeech(() -> {
            Voice voice = greekVoice();
            if (voice == null) {
                call.reject("Сначала установите греческий офлайн-голос Android", "NO_GREEK_VOICE");
                return;
            }
            speech.setLanguage(new Locale("el", "GR"));
            speech.setVoice(voice);
            speech.setSpeechRate((float) Math.max(0.5, Math.min(1.2, rate)));
            int status = speech.speak(text, TextToSpeech.QUEUE_FLUSH, null, id);
            if (status == TextToSpeech.ERROR) call.reject("Не удалось запустить озвучивание", "TTS_ERROR");
            else {
                JSObject result = new JSObject();
                result.put("id", id);
                call.resolve(result);
            }
        }));
    }

    @PluginMethod
    public void stopSpeech(PluginCall call) {
        main.post(() -> {
            if (speech != null) speech.stop();
            call.resolve();
        });
    }

    @PluginMethod
    public void openSpeechSettings(PluginCall call) {
        main.post(() -> {
            try {
                Intent intent = new Intent("com.android.settings.TTS_SETTINGS");
                try { getActivity().startActivity(intent); }
                catch (Exception missing) { getActivity().startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS)); }
                call.resolve();
            } catch (Exception error) {
                call.reject("Откройте настройки озвучивания Android вручную", "SETTINGS_UNAVAILABLE");
            }
        });
    }

    private File recordingsDirectory() throws Exception {
        File dir = new File(getContext().getFilesDir(), "recordings");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException();
        return dir;
    }

    private String requiredKey(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.trim().isEmpty() || key.length() > 250) throw new IllegalArgumentException();
        return key;
    }

    private File recordingFile(String key) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
        StringBuilder name = new StringBuilder();
        final char[] hex = "0123456789abcdef".toCharArray();
        for (byte value : digest) {
            name.append(hex[(value & 0xff) >> 4]);
            name.append(hex[value & 0x0f]);
        }
        return new File(recordingsDirectory(), name + ".m4a");
    }

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            main.post(() -> requestPermissionForAlias("microphone", call, "microphoneResult"));
            return;
        }
        beginRecording(call);
    }

    @PermissionCallback
    private void microphoneResult(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) beginRecording(call);
        else call.reject("Разрешите доступ к микрофону или ответьте текстом", "MICROPHONE_PERMISSION_DENIED");
    }

    @SuppressWarnings("deprecation")
    private synchronized void beginRecording(PluginCall call) {
        try {
            String key = requiredKey(call);
            if (recorder != null) stopRecorder();
            File pending = File.createTempFile("pending-", ".m4a", recordingsDirectory());
            MediaRecorder next = Build.VERSION.SDK_INT >= 31 ? new MediaRecorder(getContext()) : new MediaRecorder();
            try {
                next.setAudioSource(MediaRecorder.AudioSource.MIC);
                next.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
                next.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
                next.setAudioChannels(1);
                next.setAudioSamplingRate(44100);
                next.setAudioEncodingBitRate(64000);
                next.setOutputFile(pending.getAbsolutePath());
                next.setMaxDuration(180000);
                next.setOnInfoListener((r, what, extra) -> {
                    if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) {
                        try { stopRecorder(); } catch (Exception ignored) { }
                    }
                });
                next.prepare();
                next.start();
            } catch (Exception error) {
                next.release();
                pending.delete();
                throw error;
            }
            recorder = next;
            pendingRecording = pending;
            activeRecordingKey = key;
            recordingStartedAt = SystemClock.elapsedRealtime();
            call.resolve();
        } catch (Exception error) {
            call.reject("Не удалось начать запись. Проверьте разрешение микрофона.", "RECORDING_ERROR");
        }
    }

    private synchronized JSObject stopRecorder() throws Exception {
        if (recorder == null) return new JSObject();
        MediaRecorder current = recorder;
        String key = activeRecordingKey;
        File pending = pendingRecording;
        long elapsed = SystemClock.elapsedRealtime() - recordingStartedAt;
        recorder = null;
        activeRecordingKey = null;
        pendingRecording = null;
        boolean stopped = false;
        try {
            current.stop();
            stopped = true;
        } catch (RuntimeException error) {
            JSObject failed = new JSObject();
            failed.put("key", key);
            failed.put("exists", false);
            notifyListeners("recordingStopped", failed);
            throw error;
        } finally {
            current.release();
            if (!stopped && pending != null) pending.delete();
        }
        File destination = recordingFile(key);
        try {
            Files.move(pending.toPath(), destination.toPath(),
                StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (java.nio.file.AtomicMoveNotSupportedException error) {
            Files.move(pending.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
        JSObject result = new JSObject();
        result.put("key", key);
        result.put("exists", true);
        result.put("path", destination.getAbsolutePath());
        result.put("durationMs", elapsed);
        notifyListeners("recordingStopped", result);
        return result;
    }

    @PluginMethod
    public synchronized void stopRecording(PluginCall call) {
        try {
            String key = requiredKey(call);
            if (recorder != null && key.equals(activeRecordingKey)) {
                call.resolve(stopRecorder());
            } else {
                File file = recordingFile(key);
                JSObject result = new JSObject();
                result.put("exists", file.isFile());
                result.put("path", file.isFile() ? file.getAbsolutePath() : "");
                call.resolve(result);
            }
        } catch (Exception error) {
            call.reject("Запись не сохранилась. Попробуйте говорить немного дольше.", "RECORDING_ERROR");
        }
    }

    @PluginMethod
    public void getRecording(PluginCall call) {
        try {
            File file = recordingFile(requiredKey(call));
            JSObject result = new JSObject();
            result.put("exists", file.isFile());
            result.put("path", file.isFile() ? file.getAbsolutePath() : "");
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Не удалось прочитать запись", "RECORDING_ERROR");
        }
    }

    @PluginMethod
    public synchronized void clearRecordings(PluginCall call) {
        try {
            if (recorder != null) {
                try { stopRecorder(); } catch (Exception ignored) { }
            }
            File[] files = recordingsDirectory().listFiles();
            if (files != null) for (File file : files) {
                if (file.isFile() && !file.delete()) throw new IllegalStateException();
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Не удалось удалить записи", "STORAGE_ERROR");
        }
    }

    private String safeFilename(String filename, String suffix) {
        if (filename == null || !filename.matches("[A-Za-z0-9._-]{1,120}") || !filename.endsWith(suffix)) {
            throw new IllegalArgumentException();
        }
        return filename;
    }

    @PluginMethod
    public void exportJson(PluginCall call) {
        try {
            String filename = safeFilename(call.getString("filename"), ".json");
            String content = call.getString("content");
            if (content == null || content.getBytes(StandardCharsets.UTF_8).length > MAX_JSON_BYTES)
                throw new IllegalArgumentException();
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, filename);
            main.post(() -> startActivityForResult(call, intent, "jsonExportResult"));
        } catch (Exception error) {
            call.reject("Не удалось открыть сохранение файла", "DOCUMENT_ERROR");
        }
    }

    @ActivityCallback
    private void jsonExportResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != android.app.Activity.RESULT_OK || uri == null) {
            JSObject value = new JSObject(); value.put("cancelled", true); call.resolve(value); return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IllegalStateException();
            out.write(call.getString("content", "").getBytes(StandardCharsets.UTF_8));
            JSObject value = new JSObject(); value.put("saved", true); call.resolve(value);
        } catch (Exception error) {
            call.reject("Не удалось сохранить резервную копию", "DOCUMENT_ERROR");
        }
    }

    @PluginMethod
    public void importJson(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "application/json", "text/plain", "application/octet-stream" });
        main.post(() -> startActivityForResult(call, intent, "jsonImportResult"));
    }

    @ActivityCallback
    private void jsonImportResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != android.app.Activity.RESULT_OK || uri == null) {
            JSObject value = new JSObject(); value.put("cancelled", true); call.resolve(value); return;
        }
        try (InputStream input = getContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException();
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (bytes.size() + count > MAX_JSON_BYTES) throw new IllegalArgumentException();
                bytes.write(buffer, 0, count);
            }
            String filename = "progress.json";
            try (Cursor cursor = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) filename = cursor.getString(0);
            }
            JSObject value = new JSObject();
            value.put("content", bytes.toString(StandardCharsets.UTF_8.name()));
            value.put("filename", filename);
            call.resolve(value);
        } catch (Exception error) {
            call.reject("Не удалось прочитать JSON-копию размером до 10 МБ", "DOCUMENT_ERROR");
        }
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        try { stopRecorder(); } catch (Exception ignored) { }
        if (speech != null) speech.stop();
    }

    @Override
    protected void handleOnDestroy() {
        try { stopRecorder(); } catch (Exception ignored) { }
        main.post(() -> { if (speech != null) { speech.stop(); speech.shutdown(); } });
        super.handleOnDestroy();
    }
}
