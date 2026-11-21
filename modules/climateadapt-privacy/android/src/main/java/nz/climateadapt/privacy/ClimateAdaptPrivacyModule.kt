package nz.climateadapt.privacy

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.net.Uri
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.FloatBuffer
import java.security.MessageDigest
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.min
import kotlin.math.roundToInt

/** Android-only. All image IO is local. No HTTP client or backend fallback. */
class ClimateAdaptPrivacyModule : Module() {
  private val lock = Any()
  private val environment by lazy { OrtEnvironment.getEnvironment() }
  private var face: OrtSession? = null
  private var plate: OrtSession? = null
  private val faceHash = "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"
  private val plateHash = "e5350bb2152eb44fa129b2438d1e39bbbf3c27accfe51cd893ce6e17d028d0b9"

  override fun definition() = ModuleDefinition {
    Name("ClimateAdaptPrivacy")
    // Expo AsyncFunction runs off the JavaScript thread. Serialise work to bound memory.
    AsyncFunction("detect") { uri: String -> synchronized(lock) { detect(uri) } }
    AsyncFunction("apply") { uri: String, source: String, regions: String, reviewed: Boolean ->
      synchronized(lock) { apply(uri, source, regions, reviewed) }
    }
    OnDestroy { synchronized(lock) { face?.close(); plate?.close(); face=null; plate=null } }
  }
  private fun sha(data: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(data)
    .joinToString("") { "%02x".format(it.toInt() and 255) }
  private fun session(name: String, expected: String): OrtSession {
    val context = appContext.reactContext ?: error("Phone image context unavailable")
    val bytes = context.assets.open("privacy/$name").use { it.readBytes() }
    require(sha(bytes)==expected) { "Privacy model checksum failed. Rebuild with the verified model files." }
    return OrtSession.SessionOptions().use { options ->
      options.setIntraOpNumThreads(2); options.setInterOpNumThreads(1)
      environment.createSession(bytes,options)
    }
  }
  private fun models() {
    if(face!=null && plate!=null)return
    // A partial initialisation must never produce a partial success response.
    var f: OrtSession? = null
    try {
      f=session("face_detection_yunet_2023mar.onnx",faceHash)
      val p=session("plate_yolox_tiny_640.onnx",plateHash)
      face=f;plate=p
    } catch (error: Exception) { f?.close();throw error }
  }
  private fun photo(uri: String): Pair<Bitmap,String> {
    val context=appContext.reactContext ?: error("Phone image context unavailable")
    val parsed=Uri.parse(uri)
    require(parsed.scheme=="file") { "Privacy requires a prepared local photo, not a network address." }
    val file=File(parsed.path ?: error("Photo path missing")).canonicalFile
    require(file.toPath().startsWith(context.cacheDir.canonicalFile.toPath())) { "Use a prepared photo from the app cache." }
    require(file.length() in 4..(5L*1024*1024)) { "Photo exceeds the 5 MiB limit." }
    val data=file.readBytes()
    require(data.size in 4..(5*1024*1024) && (data[0].toInt() and 255)==255 && (data[1].toInt() and 255)==216) { "Use a prepared JPEG photo." }
    val bounds=BitmapFactory.Options().apply { inJustDecodeBounds=true }
    BitmapFactory.decodeByteArray(data,0,data.size,bounds)
    require(bounds.outWidth>0 && bounds.outHeight>0 && bounds.outWidth.toLong()*bounds.outHeight<=2560000) { "Invalid photo dimensions." }
    val bitmap=BitmapFactory.decodeByteArray(data,0,data.size,BitmapFactory.Options().apply { inPreferredConfig=Bitmap.Config.ARGB_8888 })
      ?: error("The photo could not be read.")
    // ImageManipulator already normalises orientation before this function is called.
    return Pair(bitmap,sha(data))
  }
  private data class Input(val values: FloatArray,val scale: Double,val px: Int,val py: Int)
  private fun input(bitmap: Bitmap,bgr: Boolean): Input {
    val scale=min(640.0/bitmap.width,640.0/bitmap.height)
    val w=(bitmap.width*scale).roundToInt().coerceAtLeast(1)
    val h=(bitmap.height*scale).roundToInt().coerceAtLeast(1)
    val px=((640-w)/2.0).roundToInt();val py=((640-h)/2.0).roundToInt()
    val prepared=Bitmap.createBitmap(640,640,Bitmap.Config.ARGB_8888)
    try {
      val canvas=Canvas(prepared);canvas.drawColor(if(bgr) Color.BLACK else Color.rgb(114,114,114))
      canvas.drawBitmap(bitmap,null,Rect(px,py,px+w,py+h),Paint(Paint.FILTER_BITMAP_FLAG))
      val pixels=IntArray(640*640);prepared.getPixels(pixels,0,640,0,0,640,640)
      val values=FloatArray(3*640*640)
      for(i in pixels.indices) {
        values[i]=(if(bgr)Color.blue(pixels[i]) else Color.red(pixels[i])).toFloat()
        values[640*640+i]=Color.green(pixels[i]).toFloat()
        values[2*640*640+i]=(if(bgr)Color.red(pixels[i]) else Color.blue(pixels[i])).toFloat()
      }
      return Input(values,scale,px,py)
    } finally { prepared.recycle() }
  }
  private fun output(result: OrtSession.Result,name: String): FloatArray {
    val tensor=result.get(name).orElseThrow { IllegalStateException("Detector output missing") } as? OnnxTensor
      ?: error("Invalid detector output")
    val buffer=tensor.floatBuffer
    return FloatArray(buffer.remaining()).also { buffer.get(it) }
  }
  private fun detectPart(bitmap: Bitmap,faces: Boolean): List<PrivacyMath.Box> {
    val inData=input(bitmap,faces)
    val session=(if(faces)face else plate) ?: error("Privacy model unavailable")
    OnnxTensor.createTensor(environment,FloatBuffer.wrap(inData.values),longArrayOf(1,3,640,640)).use { tensor ->
      session.run(mapOf(session.inputNames.first() to tensor)).use { result ->
        if(!faces) {
          val tensorOut=result[0] as? OnnxTensor ?: error("Invalid plate output")
          require(tensorOut.info.shape.contentEquals(longArrayOf(1,8400,6))) { "Plate model shape changed" }
          val buf=tensorOut.floatBuffer;val rows=FloatArray(buf.remaining());buf.get(rows)
          return PrivacyMath.plates(rows,inData.scale,inData.px,inData.py,bitmap.width,bitmap.height)
        }
        val boxes=mutableListOf<PrivacyMath.Box>()
        for(stride in listOf(8,16,32)) boxes.addAll(PrivacyMath.faces(
          output(result,"cls_$stride"),output(result,"obj_$stride"),output(result,"bbox_$stride"),stride,
          inData.scale,inData.px,inData.py,bitmap.width,bitmap.height))
        return PrivacyMath.nms(boxes,.3)
      }
    }
  }
  private fun detect(uri: String): Map<String,Any> {
    models()
    val (image,digest)=photo(uri)
    try {
      val boxes=mutableListOf<PrivacyMath.Box>()
      boxes.addAll(detectPart(image,true));boxes.addAll(detectPart(image,false))
      // Bounded overlapping crops help preserve small faces/plates in wider photographs.
      if(maxOf(image.width,image.height)>900) {
        val cw=minOf(800,image.width);val ch=minOf(800,image.height)
        for(x in setOf(0,image.width-cw)) for(y in setOf(0,image.height-ch)) {
          val crop=Bitmap.createBitmap(image,x,y,cw,ch)
          try {
            for(facePass in listOf(true,false)) for(b in detectPart(crop,facePass))
              boxes.add(PrivacyMath.Box(b.x+x,b.y+y,b.width,b.height,b.score,b.kind))
          } finally { if(crop!==image)crop.recycle() }
        }
      }
      val normal=PrivacyMath.nms(boxes,.35).map { PrivacyMath.expandAndNormalise(it,image.width,image.height) }
      return mapOf("contract" to "privacy-v1","source_sha256" to digest,"width" to image.width,"height" to image.height,
        "review_required" to true,"regions" to normal.map { b -> mapOf("x" to b.x,"y" to b.y,"width" to b.width,"height" to b.height,"kind" to b.kind) })
    } finally {image.recycle()}
  }
  private fun apply(uri: String,source: String,regionsJson: String,reviewed: Boolean): Map<String,Any> {
    require(reviewed) { "Review the whole photo before continuing." }
    require(regionsJson.length<=50000) { "Invalid privacy covers." }
    val array=JSONArray(regionsJson);require(array.length()<=100) { "Too many covers." }
    val regions=(0 until array.length()).map { i ->
      val r=array.getJSONObject(i)
      PrivacyMath.Box(r.getDouble("x"),r.getDouble("y"),r.getDouble("width"),r.getDouble("height"),1.0,r.getString("kind")).also { PrivacyMath.validate(it) }
    }
    val (image,digest)=photo(uri)
    try {
      require(digest==source) { "The photo changed. Check privacy again." }
      val covered=Bitmap.createBitmap(image.width,image.height,Bitmap.Config.ARGB_8888)
      try {
        val canvas=Canvas(covered);canvas.drawBitmap(image,0f,0f,null)
        val paint=Paint().apply {color=Color.BLACK;isAntiAlias=false}
        for(r in regions) {
          val rect=Rect(floor(r.x*image.width).toInt(),floor(r.y*image.height).toInt(),
            ceil((r.x+r.width)*image.width).toInt().coerceAtMost(image.width),ceil((r.y+r.height)*image.height).toInt().coerceAtMost(image.height))
          canvas.drawRect(rect,paint)
        }
        val encoded=ByteArrayOutputStream().use { stream ->
          check(covered.compress(Bitmap.CompressFormat.JPEG,92,stream)) { "Masked image export failed." };stream.toByteArray()
        }
        require(encoded.size<=5*1024*1024) { "Masked image exceeds the upload limit." }
        return mapOf("contract" to "privacy-v1","mime_type" to "image/jpeg","image_base64" to Base64.encodeToString(encoded,Base64.NO_WRAP),
          "width" to image.width,"height" to image.height,"bytes" to encoded.size,"mask_count" to regions.size,"sha256" to sha(encoded))
      } finally {covered.recycle()}
    } finally {image.recycle()}
  }
}
