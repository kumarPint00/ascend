package expo.modules.ascendcontext

import android.content.Intent
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine
import java.security.KeyStore
import java.security.SecureRandom
import java.time.Instant
import java.time.temporal.ChronoUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * ASCEND context security and opt-in Health Connect. No cloud service.
 * Android Keystore ciphertext cannot be decrypted on another device;
 * passphrase exports are intentionally a separate format.
 */
class AscendContextModule : Module() {
  private val alias="ASCEND_CONTEXT_AES_V1"
  private var pendingText:String?=null
  private var permissionLauncher:ActivityResultLauncher<Set<String>>?=null

  private val requestedPermissions by lazy {
    setOf(
      HealthPermission.getReadPermission(StepsRecord::class),
      HealthPermission.getReadPermission(SleepSessionRecord::class),
      HealthPermission.getReadPermission(ExerciseSessionRecord::class),
      HealthPermission.getReadPermission(HeartRateRecord::class)
    )
  }
  private fun sharedText(intent:Intent?):String? {
    if(intent==null)return null
    if(intent.action!=Intent.ACTION_SEND && intent.action!=Intent.ACTION_SEND_MULTIPLE)return null
    // No arbitrary content URI reads or Android notification scraping.
    val text=intent.getStringExtra(Intent.EXTRA_TEXT) ?: return null
    return text.take(3500).takeIf { it.isNotBlank() }
  }
  private fun localKey():SecretKey {
    val store=KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val existing=store.getKey(alias,null)
    if(existing is SecretKey)return existing
    val generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore")
    generator.init(KeyGenParameterSpec.Builder(alias,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    return generator.generateKey()
  }
  private fun cipherSeal(key:SecretKey,plain:ByteArray):ByteArray {
    val c=Cipher.getInstance("AES/GCM/NoPadding")
    c.init(Cipher.ENCRYPT_MODE,key)
    return c.iv+c.doFinal(plain)
  }
  private fun cipherOpen(key:SecretKey,buffer:ByteArray):ByteArray {
    require(buffer.size>=29) { "Encrypted record is corrupt" }
    val c=Cipher.getInstance("AES/GCM/NoPadding")
    c.init(Cipher.DECRYPT_MODE,key,GCMParameterSpec(128,buffer.copyOfRange(0,12)))
    return c.doFinal(buffer.copyOfRange(12,buffer.size))
  }
  private fun encoded(bytes:ByteArray)=Base64.encodeToString(bytes,Base64.NO_WRAP)
  private fun decoded(value:String)=Base64.decode(value,Base64.NO_WRAP)
  private fun exportKey(password:String,salt:ByteArray):SecretKey {
    require(password.length>=12) { "Use a passphrase of at least 12 characters" }
    val spec=PBEKeySpec(password.toCharArray(),salt,210000,256)
    val bytes=SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
    spec.clearPassword()
    return SecretKeySpec(bytes,"AES")
  }
  override fun definition()=ModuleDefinition {
    Name("AscendContext")
    Events("onShare","onHealthPermissions")
    OnNewIntent { intent ->
      sharedText(intent)?.let { pendingText=it;sendEvent("onShare",mapOf("text" to it)) }
    }
    val poll:suspend ()->String = {
      val found=pendingText?:sharedText(appContext.currentActivity?.intent)?:""
      pendingText=null
      found
    }
    AsyncFunction("pollShare") Coroutine poll
    AsyncFunction("encryptLocal") { plain:String ->
      require(plain.length<=12000) { "Context entry too long" }
      "ascend-local-v1:"+encoded(cipherSeal(localKey(),plain.toByteArray(Charsets.UTF_8)))
    }
    AsyncFunction("decryptLocal") { encrypted:String ->
      require(encrypted.startsWith("ascend-local-v1:")) { "Unknown encrypted record format" }
      String(cipherOpen(localKey(),decoded(encrypted.removePrefix("ascend-local-v1:"))),Charsets.UTF_8)
    }
    AsyncFunction("protectExport") { plain:String,password:String ->
      require(plain.length<=6_000_000) { "Context backup too large" }
      val salt=ByteArray(16).also { SecureRandom().nextBytes(it) }
      val encrypted=cipherSeal(exportKey(password,salt),plain.toByteArray(Charsets.UTF_8))
      "ascend-private-v1:"+encoded(salt+encrypted)
    }
    AsyncFunction("unprotectExport") { data:String,password:String ->
      require(data.startsWith("ascend-private-v1:")) { "Not an ASCEND protected context backup" }
      val bytes=decoded(data.removePrefix("ascend-private-v1:"))
      require(bytes.size>44) { "Protected backup is incomplete" }
      val salt=bytes.copyOfRange(0,16)
      String(cipherOpen(exportKey(password,salt),bytes.copyOfRange(16,bytes.size)),Charsets.UTF_8)
    }
    val healthStatus:suspend ()->Map<String,Any> = {
      val context=appContext.reactContext
        ?:throw IllegalStateException("Application context unavailable")
      val status=HealthConnectClient.getSdkStatus(context)
      if(status!=HealthConnectClient.SDK_AVAILABLE) {
        mapOf("available" to false,"granted" to emptyList<String>())
      } else {
        val client=HealthConnectClient.getOrCreate(context)
        val granted=client.permissionController.getGrantedPermissions()
        mapOf("available" to true,"granted" to granted.toList())
      }
    }
    AsyncFunction("healthStatus") Coroutine healthStatus
    RegisterActivityContracts {
      permissionLauncher=registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
      ) { _, granted ->
        sendEvent("onHealthPermissions",mapOf("granted" to granted.toList()))
      }
    }
    AsyncFunction("requestHealthPermissions") {
      val context=appContext.reactContext
        ?:throw IllegalStateException("Application context unavailable")
      if(HealthConnectClient.getSdkStatus(context)!=HealthConnectClient.SDK_AVAILABLE)
        throw IllegalStateException("Health Connect unavailable")
      val launcher=permissionLauncher
        ?:throw IllegalStateException("Health permission contract unavailable")
      launcher.launch(requestedPermissions)
    }
    val healthRead:suspend (Int)->Map<String,Any?> = { requestedDays:Int ->
      require(requestedDays in 1..30) { "Health history must be within 30 days" }
      val context=appContext.reactContext
        ?:throw IllegalStateException("Application context unavailable")
      require(HealthConnectClient.getSdkStatus(context)==HealthConnectClient.SDK_AVAILABLE) {
        "Health Connect is unavailable"
      }
      val client=HealthConnectClient.getOrCreate(context)
      val granted=client.permissionController.getGrantedPermissions()
      require(granted.isNotEmpty()) { "Grant Health Connect permissions first" }
      val end=Instant.now()
      val start=end.minus(requestedDays.toLong(),ChronoUnit.DAYS)
      val window=TimeRangeFilter.between(start,end)
      val stepsPermission=HealthPermission.getReadPermission(StepsRecord::class)
      val sleepPermission=HealthPermission.getReadPermission(SleepSessionRecord::class)
      val exercisePermission=HealthPermission.getReadPermission(ExerciseSessionRecord::class)
      val heartPermission=HealthPermission.getReadPermission(HeartRateRecord::class)
      val steps=if(granted.contains(stepsPermission))
        client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL),window))
          [StepsRecord.COUNT_TOTAL] ?:0L else null
      val sleep=if(granted.contains(sleepPermission))
        client.readRecords(ReadRecordsRequest(SleepSessionRecord::class,timeRangeFilter=window,pageSize=200))
          .records.sumOf { ChronoUnit.MINUTES.between(it.startTime,it.endTime) } else null
      val exercises=if(granted.contains(exercisePermission))
        client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class,timeRangeFilter=window,pageSize=200))
          .records.size else null
      val heart=if(granted.contains(heartPermission))
        client.readRecords(ReadRecordsRequest(HeartRateRecord::class,timeRangeFilter=window,pageSize=200))
          .records.flatMap { it.samples }.map { it.beatsPerMinute }.let {
            if(it.isNotEmpty())it.average() else null
          } else null
      mapOf("days" to requestedDays,"steps" to steps,"sleepMinutes" to sleep,
        "exerciseSessions" to exercises,"meanHeartRate" to heart,
        "from" to start.toString(),"to" to end.toString())
    }
    AsyncFunction("readHealth") Coroutine healthRead
  }
}
