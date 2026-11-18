package expo.modules.ascendcontext

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.time.LocalDate

/**
 * Safe read-only widget projection. The native widget never opens SQLite or
 * modifies XP/quests. Its data is an intentionally minimized snapshot published
 * after the existing JS game engine has calculated due quests and rewards.
 */
internal object AscendWidgetRenderer {
  private const val PREFS = "ascend_widget_projection"
  private const val MAX_BYTES = 12000
  private val names = listOf(
    DailyQuestWidget::class.java,
    HunterStatusWidget::class.java,
    FocusPlannerWidget::class.java,
    ProgressWidget::class.java
  )
  fun publish(context:Context,json:String) {
    require(json.toByteArray(Charsets.UTF_8).size<=MAX_BYTES) { "Widget snapshot too large" }
    val data=JSONObject(json)
    require(data.optInt("schema")==1) { "Unsupported widget projection version" }
    require(data.optString("day").matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) {
      "Invalid widget projection day"
    }
    context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
      .putString("snapshot",data.toString()).apply()
    refreshAll(context)
  }
  fun refreshAll(context:Context) {
    val manager=AppWidgetManager.getInstance(context)
    for (type in names) {
      val component=ComponentName(context,type)
      manager.getAppWidgetIds(component).forEach { id ->
        val options=manager.getAppWidgetOptions(id)
        render(context,manager,id,type,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,160))
      }
    }
  }
  private fun text(obj:JSONObject?,field:String,default:String):String {
    val safe=obj?.optString(field,default)?:default
    return safe.trim().replace(Regex("[\\p{Cntrl}&&[^\\n\\t]]"),"").take(110)
  }
  fun render(context:Context,manager:AppWidgetManager,id:Int,receiver:Class<*>,widthDp:Int) {
    val kind=when(receiver) {
      DailyQuestWidget::class.java->"daily"
      HunterStatusWidget::class.java->"hunter"
      FocusPlannerWidget::class.java->"planner"
      else->"progress"
    }
    val all=try {
      val saved=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString("snapshot",null)
      if(saved.isNullOrEmpty())null else JSONObject(saved)
    } catch(_:Exception){null}
    val active=all?.optBoolean("enabled",true)?:true
    val today=LocalDate.now().toString()
    val fresh=active&&all?.optString("day")==today
    val section=if(fresh)all?.optJSONObject(kind) else null
    val compact=widthDp<220
    val layout=if(compact)R.layout.ascend_widget_compact else R.layout.ascend_widget_wide
    val view=RemoteViews(context.packageName,layout)
    val title=when(kind) {
      "daily"->"DAILY QUESTS"
      "hunter"->"HUNTER STATUS"
      "planner"->"FOCUS & PLANNER"
      else->"PROGRESS"
    }
    val defaultStatus=when {
      !active->"Widgets paused"
      all==null->"Open ASCEND to begin"
      !fresh->"Open ASCEND to refresh"
      else->"No information yet"
    }
    view.setTextViewText(R.id.ascend_widget_title,title)
    view.setTextViewText(R.id.ascend_widget_primary,
      text(section,"primary",defaultStatus))
    view.setTextViewText(R.id.ascend_widget_secondary,
      text(section,"secondary",if(fresh)"Tap to view details" else "Your data stays in ASCEND"))
    view.setTextViewText(R.id.ascend_widget_tertiary,text(section,"tertiary",""))
    view.setViewVisibility(R.id.ascend_widget_tertiary,
      if(compact||section==null)View.GONE else View.VISIBLE)
    val progress=if(fresh)(section?.optInt("progress",0)?:0).coerceIn(0,100) else 0
    view.setProgressBar(R.id.ascend_widget_progress,100,progress,false)
    view.setViewVisibility(R.id.ascend_widget_progress,
      if(!fresh||section==null)View.GONE else View.VISIBLE)
    val route=when(kind){
      "daily"->"quests"
      "hunter"->"hunter"
      "planner"->"planner"
      else->"progress"
    }
    val intent=context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(Intent.ACTION_VIEW)
    intent.action=Intent.ACTION_VIEW
    intent.data=Uri.parse("ascendrpg://widget/$route")
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val pending=PendingIntent.getActivity(context,
      id*10+(when(kind){"daily"->1;"hunter"->2;"planner"->3;else->4}),
      intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    view.setOnClickPendingIntent(R.id.ascend_widget_root,pending)
    manager.updateAppWidget(id,view)
  }
}

abstract class AscendWidgetProvider(private val receiver:Class<*>):AppWidgetProvider(){
  override fun onUpdate(context:Context,manager:AppWidgetManager,ids:IntArray) {
    for(id in ids)AscendWidgetRenderer.render(context,manager,id,receiver,
      manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,160))
  }
  override fun onAppWidgetOptionsChanged(context:Context,manager:AppWidgetManager,id:Int,options:android.os.Bundle) {
    AscendWidgetRenderer.render(context,manager,id,receiver,
      options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,160))
  }
}
class DailyQuestWidget:AscendWidgetProvider(DailyQuestWidget::class.java)
class HunterStatusWidget:AscendWidgetProvider(HunterStatusWidget::class.java)
class FocusPlannerWidget:AscendWidgetProvider(FocusPlannerWidget::class.java)
class ProgressWidget:AscendWidgetProvider(ProgressWidget::class.java)
