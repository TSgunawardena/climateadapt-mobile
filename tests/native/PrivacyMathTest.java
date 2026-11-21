import nz.climateadapt.privacy.PrivacyMath;
import java.util.Arrays;

public class PrivacyMathTest {
  private static void check(boolean result) { if(!result)throw new AssertionError(); }
  private static void bad(Runnable call) {try {call.run();throw new AssertionError("Accepted invalid input");}catch(IllegalArgumentException expected){}}
  public static void main(String[] args) {
    PrivacyMath.Box b=new PrivacyMath.Box(0,0,10,10,.9,"face");
    PrivacyMath.Box expanded=PrivacyMath.expandAndNormalise(b,100,100);
    check(expanded.x==0 && expanded.y==0 && expanded.width==.18);
    bad(()->PrivacyMath.validate(new PrivacyMath.Box(Double.NaN,0,.1,.1,1,"face")));
    bad(()->PrivacyMath.validate(new PrivacyMath.Box(.9,0,.2,.1,1,"manual")));
    check(PrivacyMath.nms(Arrays.asList(b,new PrivacyMath.Box(0,0,10,10,.8,"face"),new PrivacyMath.Box(0,0,10,10,.8,"plate")),.4).size()==2);
    float[] rows=new float[8400*6];rows[0]=320;rows[1]=320;rows[2]=100;rows[3]=40;rows[4]=.9f;rows[5]=.9f;
    PrivacyMath.Box plate=PrivacyMath.plates(rows,1,0,0,640,640).get(0);
    check(plate.x==270 && plate.y==300 && plate.width==100 && plate.height==40);
    rows[4]=Float.NaN;bad(()->PrivacyMath.plates(rows,1,0,0,640,640));
    float[] cls=new float[80*80],obj=new float[80*80],box=new float[80*80*4];int index=20*80+20;cls[index]=.9f;obj[index]=.9f;
    box[index*4]=.5f;box[index*4+1]=.5f;
    PrivacyMath.Box face=PrivacyMath.faces(cls,obj,box,8,1,0,0,640,640).get(0);
    check(face.x==160 && face.y==160 && face.width==8 && face.height==8);
    bad(()->PrivacyMath.faces(new float[1],obj,box,8,1,0,0,640,640));
    System.out.println("8 native geometry and model decoding checks passed");
  }
}
