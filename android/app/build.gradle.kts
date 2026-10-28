plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Signing credentials are supplied only by the GitHub Actions release job
// (or explicitly by the developer's local environment). Never commit them.
val signingFilePath = providers.environmentVariable("ANDROID_SIGNING_STORE_FILE").orNull
val signingStorePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD").orNull
val signingKeyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS").orNull
val signingKeyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD").orNull

val signingReady = listOf(
    signingFilePath, signingStorePassword, signingKeyAlias, signingKeyPassword
).all { !it.isNullOrBlank() }

android {
    namespace = "io.github.matie.wereadhighlights"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.matie.wereadhighlights"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "0.2.3"
    }

    signingConfigs {
        if (signingReady) {
            create("production") {
                storeFile = file(signingFilePath!!)
                storePassword = signingStorePassword!!
                keyAlias = signingKeyAlias!!
                keyPassword = signingKeyPassword!!
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (signingReady) {
                signingConfig = signingConfigs.getByName("production")
            }
        }
    }
}

// Refuse to produce an unsigned release when signing secrets are absent.
// Debug builds and ordinary IDE project sync never require the secrets.
val verifyReleaseSigning = tasks.register("verifyReleaseSigning") {
    group = "verification"
    doLast {
        check(signingReady && java.io.File(signingFilePath!!).isFile) {
            "Release signing is not configured. Supply ANDROID_SIGNING_STORE_FILE, " +
                "ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, and ANDROID_KEY_PASSWORD."
        }
    }
}
tasks.matching { it.name == "assembleRelease" || it.name == "bundleRelease" }
    .configureEach { dependsOn(verifyReleaseSigning) }

dependencies {
    implementation("androidx.work:work-runtime:2.10.0")
    testImplementation("junit:junit:4.13.2")
}
