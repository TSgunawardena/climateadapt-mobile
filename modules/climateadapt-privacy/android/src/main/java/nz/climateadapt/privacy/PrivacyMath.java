package nz.climateadapt.privacy;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Pure geometry and pinned-model decoding, independent of Android and the network. */
public final class PrivacyMath {
  private PrivacyMath() {}
  public static final class Box {
    public final double x, y, width, height, score;
    public final String kind;
    public Box(double x, double y, double width, double height, double score, String kind) {
      this.x=x; this.y=y; this.width=width; this.height=height; this.score=score; this.kind=kind;
    }
  }
  private static void require(boolean condition, String message) {
    if (!condition) throw new IllegalArgumentException(message);
  }
  public static void validate(Box b) {
    require(Double.isFinite(b.x) && Double.isFinite(b.y) && Double.isFinite(b.width) && Double.isFinite(b.height), "Invalid cover coordinates");
    require(b.x>=0 && b.y>=0 && b.width>0 && b.height>0 && b.x+b.width<=1.000001 && b.y+b.height<=1.000001, "Cover outside image");
    require(b.kind.equals("face") || b.kind.equals("plate") || b.kind.equals("manual"), "Unknown cover kind");
  }
  public static double iou(Box a, Box b) {
    double w=Math.max(0, Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
    double h=Math.max(0, Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
    double intersection=w*h;
    return intersection/Math.max(1e-12,a.width*a.height+b.width*b.height-intersection);
  }
  public static List<Box> nms(List<Box> input, double threshold) {
    List<Box> ordered=new ArrayList<>(input); ordered.sort(Comparator.comparingDouble((Box b)->b.score).reversed());
    List<Box> kept=new ArrayList<>();
    for (Box b:ordered) {
      boolean overlap=false;
      for(Box old:kept) if(old.kind.equals(b.kind) && iou(old,b)>threshold) {overlap=true;break;}
      if(!overlap) kept.add(b);
      if(kept.size()>100) throw new IllegalArgumentException("Too many private details. Choose a simpler photo.");
    }
    return kept;
  }
  private static Box unletterbox(double cx,double cy,double w,double h,double score,String kind,
      double scale,int px,int py,int width,int height) {
    if(!Double.isFinite(cx)||!Double.isFinite(cy)||!Double.isFinite(w)||!Double.isFinite(h)||!Double.isFinite(score))
      throw new IllegalArgumentException("Nonfinite detector output");
    double left=Math.max(0,(cx-w/2-px)/scale),top=Math.max(0,(cy-h/2-py)/scale);
    double right=Math.min(width,(cx+w/2-px)/scale),bottom=Math.min(height,(cy+h/2-py)/scale);
    if(right<=left || bottom<=top) return null;
    return new Box(left,top,right-left,bottom-top,score,kind);
  }
  public static List<Box> plates(float[] rows,double scale,int px,int py,int width,int height) {
    require(rows.length==8400*6,"Unexpected plate output shape");
    List<Box> boxes=new ArrayList<>();
    for(int i=0;i<8400;i++) {
      int k=i*6;double score=rows[k+4]*rows[k+5];
      if(!Double.isFinite(score))throw new IllegalArgumentException("Invalid plate score");
      if(score<.25)continue;
      Box b=unletterbox(rows[k],rows[k+1],rows[k+2],rows[k+3],score,"plate",scale,px,py,width,height);
      if(b!=null)boxes.add(b);
    }
    return nms(boxes,.4);
  }
  public static List<Box> faces(float[] cls,float[] obj,float[] bbox,int stride,
      double scale,int px,int py,int width,int height) {
    int side=640/stride,count=side*side;
    require(cls.length==count&&obj.length==count&&bbox.length==count*4,"Unexpected face output shape");
    List<Box> boxes=new ArrayList<>();
    for(int i=0;i<count;i++) {
      if(!Float.isFinite(cls[i]) || !Float.isFinite(obj[i])) throw new IllegalArgumentException("Invalid face score");
      double score=Math.sqrt(Math.max(0,Math.min(1,cls[i]))*Math.max(0,Math.min(1,obj[i])));
      if(score<.65)continue;
      double cx=(i%side+bbox[i*4])*stride,cy=(i/side+bbox[i*4+1])*stride;
      double w=Math.exp(bbox[i*4+2])*stride,h=Math.exp(bbox[i*4+3])*stride;
      Box b=unletterbox(cx,cy,w,h,score,"face",scale,px,py,width,height);
      if(b!=null)boxes.add(b);
    }
    return boxes;
  }
  public static Box expandAndNormalise(Box b,int imageWidth,int imageHeight) {
    double mx=Math.max(8,b.width*.2),my=Math.max(8,b.height*.2);
    double x=Math.max(0,b.x-mx),y=Math.max(0,b.y-my);
    double right=Math.min(imageWidth,b.x+b.width+mx),bottom=Math.min(imageHeight,b.y+b.height+my);
    Box normal=new Box(x/imageWidth,y/imageHeight,(right-x)/imageWidth,(bottom-y)/imageHeight,b.score,b.kind);
    validate(normal);return normal;
  }
}
