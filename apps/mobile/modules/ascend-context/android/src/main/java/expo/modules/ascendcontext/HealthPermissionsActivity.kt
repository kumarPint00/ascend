package expo.modules.ascendcontext

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord

/** Contract registered before STARTED, as required by AndroidX ActivityResult.
 * The user can deny any subset of scopes. ASCEND checks grants again on sync.
 */
class HealthPermissionsActivity : ComponentActivity() {
  private val requested=setOf(
    HealthPermission.getReadPermission(StepsRecord::class),
    HealthPermission.getReadPermission(SleepSessionRecord::class),
    HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    HealthPermission.getReadPermission(HeartRateRecord::class)
  )
  private val permissionsLauncher=registerForActivityResult(
    PermissionController.createRequestPermissionResultContract()
  ) { finish() }

  override fun onCreate(savedInstanceState:Bundle?) {
    super.onCreate(savedInstanceState)
    if(savedInstanceState==null)permissionsLauncher.launch(requested)
  }
}
