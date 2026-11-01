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
        versionCode = 1024
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildFeatures { buildConfig = true }
    defaultConfig {
        for (key in listOf("H2O_FIREBASE_APP_ID", "H2O_FIREBASE_API_KEY", "H2O_FIREBASE_PROJECT_ID", "H2O_FIREBASE_SENDER_ID")) {
            val value = providers.environmentVariable(key).orNull.orEmpty()
            require(value.matches(Regex("[A-Za-z0-9_:.-]*"))) { "Invalid Firebase public configuration" }
            buildConfigField("String", key, "\"$value\"")
        }
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
    implementation(platform("com.google.firebase:firebase-bom:34.5.0"))
    implementation("com.google.firebase:firebase-messaging")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:core-ktx:1.6.1")
    testImplementation("junit:junit:4.13.2")
}
