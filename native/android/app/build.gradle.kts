import java.io.File

plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
val signingNames = listOf("H2O_ANDROID_KEYSTORE", "H2O_ANDROID_STORE_PASSWORD", "H2O_ANDROID_KEY_ALIAS", "H2O_ANDROID_KEY_PASSWORD")
val signingValues = signingNames.associateWith { providers.environmentVariable(it).orNull }
val hasSigning = signingValues.values.all { !it.isNullOrBlank() }
if (signingValues.values.any { !it.isNullOrBlank() } && !hasSigning) throw GradleException("Die Android-Signierung ist unvollständig konfiguriert.")
if (providers.environmentVariable("H2O_REQUIRE_RELEASE_SIGNING").orNull == "true" && !hasSigning) throw GradleException("Release-Signierung fehlt. Keine Store-Datei freigegeben.")
if (hasSigning && !File(signingValues.getValue("H2O_ANDROID_KEYSTORE")!!).isFile) throw GradleException("Die Android-Keystore-Datei fehlt.")
android {
    if (hasSigning) signingConfigs.create("storeRelease") {
        storeFile = File(signingValues.getValue("H2O_ANDROID_KEYSTORE")!!)
        storePassword = signingValues.getValue("H2O_ANDROID_STORE_PASSWORD")
        keyAlias = signingValues.getValue("H2O_ANDROID_KEY_ALIAS")
        keyPassword = signingValues.getValue("H2O_ANDROID_KEY_PASSWORD")
    }
    namespace = "de.feuerwehrwasser.h2o"
    compileSdk = 36
    sourceSets["main"].assets.srcDir(file("../../shared"))
    defaultConfig {
        applicationId = "de.feuerwehrwasser.h2o"
        minSdk = 28
        targetSdk = 36
        versionCode = 2
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (hasSigning) signingConfig = signingConfigs.getByName("storeRelease")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.credentials:credentials:1.5.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.5.0")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    testImplementation("junit:junit:4.13.2")
}
