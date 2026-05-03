# Capacitor specific ProGuard/R8 rules

# Keep Capacitor core
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }

# Keep Capacitor plugins
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.getcapacitor.community.** { *; }

# Keep Lole custom plugins
-keep class com.lole.device.plugins.** { *; }
-keep class com.lole.device.LoleFirebaseMessagingService { *; }
-keep class com.lole.device.SyncWorker { *; }
-keep class com.lole.device.BootReceiver { *; }

# Keep @CapacitorPlugin annotated classes
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Keep @PluginMethod annotated methods
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}

# AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Sentry
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# General
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes EnclosingMethod

# Remove debug logging in release
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int d(...);
    public static int v(...);
}
