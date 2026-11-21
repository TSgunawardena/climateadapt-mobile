import PrivacyMaskEditor from './src/PrivacyMaskEditor';
import { detectPrivacy } from './src/privacy-api';
import { canAnalysePhoto, type PrivacyScan, type MaskedPhoto } from './src/privacy';
import EvaluationPanel from './src/EvaluationPanel';
import { evaluation } from './src/evaluation';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Easing, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import * as Picker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FS from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useFonts, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { c, fonts } from './src/theme';
import { modes, parsePhotoHealth, RequestGate, validateBaseUrl, type AnalysisResult, type AnalysisState, type DemoMode, type PhotoBackendKind } from './src/domain';
import { analyse } from './src/api';
import PlaceWorkspace from './src/PlaceWorkspace';
import PhotoFindings from './src/PhotoFindings';
type Screen = 'home'|'capture'|'review'|'analysis'|'setup'|'explore'|'planning'|'reports';
type Photo = {uri:string;width:number;height:number;bytes:number;originalBytes?:number;created:string;privacy:'unchecked'|'reviewed';maskCount:number};
const coast=require('./assets/design/coast.jpg');
const coastMotion=require('./assets/design/coast-motion.gif');
const icons={home:require('./assets/design/home.svg'),explore:require('./assets/design/map.svg'),capture:require('./assets/design/camera.svg'),planning:require('./assets/design/plan.svg'),reports:require('./assets/design/file.svg'),back:require('./assets/design/back.svg'),settings:{uri:'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%233653FF%22 stroke-width=%221.8%22 stroke-linecap=%22round%22%3E%3Cpath d=%22M4 6h16M4 12h16M4 18h16%22/%3E%3Ccircle cx=%228%22 cy=%226%22 r=%222%22 fill=%22white%22/%3E%3Ccircle cx=%2216%22 cy=%2212%22 r=%222%22 fill=%22white%22/%3E%3Ccircle cx=%2210%22 cy=%2218%22 r=%222%22 fill=%22white%22/%3E%3C/svg%3E'}};
const cache=FS.cacheDirectory?`${FS.cacheDirectory}climateadapt/`:'';
const labels:Record<DemoMode,string>={normal:'Normal result',low:'Needs review',slow:'Slow (6 seconds)',error:'Service unavailable',rate:'Service busy',malformed:'Unreadable response',timeout:'Timeout (60 seconds)'};
function defaultAddress(){return `http://${Constants.expoConfig?.hostUri?.split(':')[0]||'localhost'}:8080`;}
function message(e:unknown){return e instanceof Error?e.message:'Something went wrong. Please try again.';}
function Icon({name}:{name:keyof typeof icons}){return <Image source={icons[name]} style={{width:24,height:24}} contentFit="contain" accessible={false}/>;}
function Button({title,onPress,secondary=false,disabled=false}:{title:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){
 const[focused,setFocused]=useState(false);return <Pressable accessibilityRole="button" accessibilityState={{disabled}} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onPress={onPress} disabled={disabled} style={({pressed})=>[s.button,secondary&&s.secondary,disabled&&{opacity:0.5},pressed&&{transform:[{translateY:3}],borderBottomWidth:2},focused&&s.focus]}><Text style={[s.buttonText,secondary&&{color:c.teal}]}>{title}</Text></Pressable>;
}
function Card({title,body,tone='white'}:{title:string;body:string;tone?:'white'|'mint'|'sand'|'blueTint'}){return <View style={[s.card,{backgroundColor:c[tone]}]}><Text style={s.cardTitle}>{title}</Text><Text style={s.body}>{body}</Text></View>;}
// Cosmetic pending animation. It does not represent measured inference progress.
function ScanningPhoto({uri}:{uri:string}){
 const scan=useRef(new Animated.Value(0)).current;
 const blurOpacity=useRef(new Animated.Value(0)).current;
 const[reduceMotion,setReduceMotion]=useState(true);
 const[imageReady,setImageReady]=useState(false);
 const[height,setHeight]=useState(240);
 useEffect(()=>{
  let active=true;
  let preferenceChanged=false;
  const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',enabled=>{
   preferenceChanged=true;
   if(active)setReduceMotion(enabled);
  });
  void AccessibilityInfo.isReduceMotionEnabled().then(enabled=>{
   if(active&&!preferenceChanged)setReduceMotion(enabled);
  }).catch(()=>{});
  return()=>{active=false;subscription.remove();};
 },[]);
 useEffect(()=>{
  scan.setValue(0);
  blurOpacity.setValue(0);
  if(reduceMotion||!imageReady)return;
  const useNativeDriver=Platform.OS!=='web';
  const sweep=Animated.loop(Animated.sequence([
   Animated.timing(scan,{toValue:1,duration:2400,easing:Easing.inOut(Easing.sin),useNativeDriver,isInteraction:false}),
   Animated.timing(scan,{toValue:0,duration:2400,easing:Easing.inOut(Easing.sin),useNativeDriver,isInteraction:false}),
  ]));
  const blur=Animated.loop(Animated.sequence([
   Animated.timing(blurOpacity,{toValue:0.85,duration:1800,easing:Easing.inOut(Easing.sin),useNativeDriver,isInteraction:false}),
   Animated.timing(blurOpacity,{toValue:0.35,duration:1800,easing:Easing.inOut(Easing.sin),useNativeDriver,isInteraction:false}),
  ]));
  sweep.start();blur.start();
  return()=>{sweep.stop();blur.stop();scan.stopAnimation();blurOpacity.stopAnimation();};
 },[scan,blurOpacity,reduceMotion,imageReady]);
 const translateY=scan.interpolate({
  inputRange:[0,1],
  outputRange:[0,Math.max(0,height-32)],
 });
 return (
  <View
   style={s.scanFrame}
   onLayout={event=>setHeight(event.nativeEvent.layout.height)}
   accessible
   accessibilityLabel="Your selected photo. Analysis in progress."
  >
   <Image source={{uri}} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="none" accessible={false}/>
   {!reduceMotion&&(
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,{opacity:blurOpacity}]}>
     <Image source={{uri}} blurRadius={8} onLoad={()=>setImageReady(true)} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="none" accessible={false}/>
    </Animated.View>
   )}
   {!reduceMotion&&imageReady&&(
    <Animated.View
     pointerEvents="none"
     style={[s.scanSweep,{transform:[{translateY}]}]}
    >
     <View style={s.scanGlow}/>
     <View style={s.scanLine}/>
    </Animated.View>
   )}
  </View>
 );
}

// A bundled camera-motion GIF, with the original JPEG as a still fallback.
function LiveCoast({height}:{height:number}){
 const[reduceMotion,setReduceMotion]=useState(true);
 const[foreground,setForeground]=useState(AppState.currentState!=='background'&&AppState.currentState!=='inactive');
 const[gifFailed,setGifFailed]=useState(false);
 useEffect(()=>{
  let mounted=true;
  let changed=false;
  const preference=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{
   changed=true;
   if(mounted)setReduceMotion(value);
  });
  void AccessibilityInfo.isReduceMotionEnabled().then(value=>{
   if(mounted&&!changed)setReduceMotion(value);
  }).catch(()=>{});
  const appState=AppState.addEventListener('change',value=>setForeground(value==='active'));
  return()=>{mounted=false;preference.remove();appState.remove();};
 },[]);
 const animate=foreground&&!reduceMotion&&!gifFailed;
 return (
  <View style={{height,width:'100%',overflow:'hidden',borderRadius:24}} pointerEvents="none">
   <Image
    source={animate?coastMotion:coast}
    style={StyleSheet.absoluteFill}
    contentFit="cover"
    autoplay={animate}
    accessible={false}
    onError={()=>{if(animate)setGifFailed(true);}}
   />
  </View>
 );
}

function Content(){
 const evaluationState=useSyncExternalStore(evaluation.subscribe,evaluation.snapshot);
 const[evaluationOpen,setEvaluationOpen]=useState(false);
 const[loaded,fontError]=useFonts({Manrope_400Regular,Manrope_600SemiBold,Manrope_700Bold,Manrope_800ExtraBold});
 const[screen,setScreen]=useState<Screen>('home');const[photo,setPhoto]=useState<Photo|null>(null);const[state,setState]=useState<AnalysisState>({kind:'idle'});
 const[busy,setBusy]=useState(false);const[notice,setNotice]=useState('');const[notes,setNotes]=useState('');const[location,setLocation]=useState<{latitude:number;longitude:number}|null>(null);
 const[base,setBase]=useState(defaultAddress);const[address,setAddress]=useState(base);const[mode,setMode]=useState<DemoMode>('normal');const[health,setHealth]=useState('');const[summaries,setSummaries]=useState<AnalysisResult[]>([]);const[seconds,setSeconds]=useState(0);
 const[placesBase,setPlacesBase]=useState(()=>defaultAddress().replace(':8080',':8081'));
 const[privacyChecking,setPrivacyChecking]=useState(false);
 const[privacyScan,setPrivacyScan]=useState<PrivacyScan|null>(null);
 const privacyRequest=useRef<AbortController|null>(null);
 const privacyReviewSource=useRef<string|null>(null);
 const[photoBackend,setPhotoBackend]=useState<PhotoBackendKind|'unverified'>('unverified');
 const gate=useRef(new RequestGate());const request=useRef<AbortController|null>(null);const pickerGeneration=useRef(0);const healthRequest=useRef<AbortController|null>(null);const photoRef=useRef<Photo|null>(null);photoRef.current=photo;const scroll=useRef<React.ComponentRef<typeof ScrollView>>(null);
 async function erase(uri?:string){if(!uri)return;if(Platform.OS==='web'){if(uri.startsWith('blob:'))URL.revokeObjectURL(uri);return;}if(FS.cacheDirectory&&uri.startsWith(FS.cacheDirectory))await FS.deleteAsync(uri,{idempotent:true}).catch(()=>{});}
 function cancel(){if(request.current)evaluation.log('waiting_cancelled');gate.current.invalidate();request.current?.abort();request.current=null;setState({kind:'idle'});}
 function go(next:Screen){privacyReviewSource.current=null;if(privacyRequest.current){privacyRequest.current.abort();privacyRequest.current=null;setPrivacyChecking(false);setBusy(false);}setPrivacyScan(null);if(next==='capture')evaluation.log('capture_opened');if(next==='review')evaluation.log('review_opened');if(state.kind==='uploading')cancel();setNotice('');setScreen(next);}
 async function clearPhoto(){privacyReviewSource.current=null;privacyRequest.current?.abort();privacyRequest.current=null;setPrivacyChecking(false);setBusy(false);setPrivacyScan(null);evaluation.log('photo_discarded');cancel();++pickerGeneration.current;await erase(photoRef.current?.uri);setPhoto(null);setLocation(null);setNotes('');setNotice('');}
 useEffect(()=>{if(Platform.OS!=='web'&&cache)void FS.deleteAsync(cache,{idempotent:true}).then(()=>FS.makeDirectoryAsync(cache,{intermediates:true})).catch(()=>{});return()=>{gate.current.invalidate();request.current?.abort();privacyRequest.current?.abort();healthRequest.current?.abort();void erase(photoRef.current?.uri);};},[]);
 useEffect(()=>{if(screen==='analysis'&&state.kind==='result')evaluation.log('result_shown');},[screen,state.kind]);
 useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[screen,state.kind]);
 useEffect(()=>{if(state.kind!=='uploading')return;setSeconds(0);const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-state.started)/1000)),1000);return()=>clearInterval(timer);},[state]);
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{if(screen==='home')return false;go(screen==='analysis'&&photo?'review':'home');return true;});return()=>sub.remove();},[screen,photo,state.kind]);
 useEffect(()=>{const sub=AppState.addEventListener('change',v=>{if(v==='background'&&request.current){cancel();setScreen('review');setNotice('Analysis cancelled in the background. You can send the photo again.');}});return()=>sub.remove();},[]);
 async function choose(camera:boolean){
  if(busy)return;cancel();setBusy(true);setNotice('');const id=++pickerGeneration.current;let original:string|undefined,temp:string|undefined;
  try{if(camera){const p=await Picker.requestCameraPermissionsAsync();if(!p.granted){setNotice('Camera permission was not granted. You can choose a gallery photo instead.');return;}}
   const result=camera?await Picker.launchCameraAsync({mediaTypes:['images'],quality:1,exif:false}):await Picker.launchImageLibraryAsync({mediaTypes:['images'],quality:1,exif:false});if(result.canceled)return;
   evaluation.log('photo_selected',camera?'camera':'gallery');
   const selected=result.assets[0];original=selected.uri;const ctx=ImageManipulator.manipulate(selected.uri,{maxWidth:1600,maxHeight:1600});const rendered=await ctx.renderAsync();const prepared=await rendered.saveAsync({format:SaveFormat.JPEG,compress:0.82});temp=prepared.uri;
   let uri=prepared.uri,bytes=0;if(Platform.OS==='web')bytes=(await(await fetch(uri)).blob()).size;else{await FS.makeDirectoryAsync(cache,{intermediates:true});uri=`${cache}${Date.now()}.jpg`;await FS.copyAsync({from:prepared.uri,to:uri});const info=await FS.getInfoAsync(uri);bytes=info.exists?info.size:0;await erase(prepared.uri);}
   if(id!==pickerGeneration.current){await erase(uri);return;}await erase(photoRef.current?.uri);setLocation(null);setNotes('');evaluation.log('photo_ready');const nextPhoto:Photo={uri,width:prepared.width,height:prepared.height,bytes,originalBytes:selected.fileSize,created:new Date().toISOString(),privacy:'unchecked',maskCount:0};photoRef.current=nextPhoto;setPhoto(nextPhoto);setState({kind:'idle'});setScreen('review');await scanPrivacy(nextPhoto);
  }catch(e){evaluation.log('preparation_failed');setNotice(`We could not prepare that photo. ${message(e)}`);await erase(temp);}finally{await erase(original);if(id===pickerGeneration.current)setBusy(false);}
 }
 async function scanPrivacy(preparedPhoto?:Photo){
  const selected=preparedPhoto??photoRef.current;
  if(!selected||(!preparedPhoto&&busy))return;
  const controller=new AbortController();privacyRequest.current?.abort();privacyRequest.current=controller;
  evaluation.log('privacy_requested');const timeout=setTimeout(()=>controller.abort(),45000);setBusy(true);setPrivacyChecking(true);setNotice('');
  try{
   const scan=await detectPrivacy(selected.uri,controller.signal);
   if(controller.signal.aborted||privacyRequest.current!==controller||photoRef.current?.uri!==selected.uri)return;
   if(scan.width!==selected.width||scan.height!==selected.height)throw Error('The privacy photo dimensions changed. Choose it again.');
   evaluation.log('privacy_review_opened');privacyReviewSource.current=scan.source_sha256;setPrivacyScan(scan);setNotice('');
  }catch(error){
   if(privacyRequest.current===controller)evaluation.log(controller.signal.aborted?'privacy_cancelled':'privacy_failed');
   if(privacyRequest.current===controller)setNotice(controller.signal.aborted?'Privacy checking was cancelled or timed out. No unchecked photo has been uploaded.':message(error));
  }finally{clearTimeout(timeout);if(privacyRequest.current===controller){privacyRequest.current=null;setPrivacyChecking(false);setBusy(false);}}
 }
 async function acceptMasked(masked:MaskedPhoto,sourceUri:string,sourceDigest:string){
  if(photoRef.current?.uri!==sourceUri||privacyReviewSource.current!==sourceDigest){await erase(masked.uri);return;}
  cancel();privacyReviewSource.current=null;evaluation.log('privacy_applied');
  setPhoto(previous=>previous&&previous.uri===sourceUri?{...previous,...masked,privacy:'reviewed'}:previous);
  setPrivacyScan(null);setNotice('Privacy review completed. Check the new image before tapping Analyse.');
  await erase(sourceUri);
 }
 async function addLocation(){setBusy(true);setNotice('');try{const p=await Location.requestForegroundPermissionsAsync();if(!p.granted){setNotice('Location was not shared. You can continue with the photo only.');return;}const l=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});setLocation({latitude:l.coords.latitude,longitude:l.coords.longitude});}catch{setNotice('We could not get your location. Continue without it.');}finally{setBusy(false);}}
 async function submit(){
  if(!photo||busy)return;if(!canAnalysePhoto(photo,!!privacyScan)){setNotice('Check faces and number plates before analysis.');return;}if(photoBackend==='unverified'){setNotice('Connect the photo service in Setup before sending this observation.');setScreen('setup');return;}cancel();const id=gate.current.next(),ctrl=new AbortController(),started=Date.now();evaluation.log('analysis_requested');let timedOut=false;request.current=ctrl;setState({kind:'uploading',started});setScreen('analysis');setNotice('');const timer=setTimeout(()=>{timedOut=true;ctrl.abort();},60000);
  try{const result=await analyse(base,mode,photo.uri,ctrl.signal,{location,notes,created:photo.created},photoBackend);if(gate.current.accepts(id)){evaluation.log('result_received',result.demo?(result.status==='needs_review'?'mock_needs_review':'mock_done'):(result.status==='needs_review'?'needs_review':'done'));setState({kind:'result',result,elapsedMs:Date.now()-started});}}
  catch(e){if(!gate.current.accepts(id))return;evaluation.log('request_failed');const msg=message(e);setState({kind:'failed',message:timedOut?'No response arrived within 60 seconds. Check the connection and try again.':msg==='Failed to fetch'||msg.includes('Network request failed')?'The backend could not be reached. Open Setup and check its address.':msg,retryable:timedOut||(e as {retryable?:boolean}).retryable!==false});}
  finally{clearTimeout(timer);if(gate.current.accepts(id))request.current=null;}
 }
 async function check(){healthRequest.current?.abort();const ctrl=new AbortController();healthRequest.current=ctrl;const timer=setTimeout(()=>ctrl.abort(),8000);setPhotoBackend('unverified');setHealth('Checking…');try{const value=validateBaseUrl(address);const res=await fetch(`${value}/api/health`,{signal:ctrl.signal});if(!res.ok)throw Error('The photo service is not ready.');const kind=parsePhotoHealth(await res.json());if(healthRequest.current!==ctrl)return;setBase(value);setPhotoBackend(kind);setMode('normal');setHealth(kind==='live_vision'?'Connected to local Gemma photo analysis. Settings applied.':'Connected to mock photo backend. Results are fixed demonstrations.');}catch(e){if(healthRequest.current===ctrl)setHealth(`Not connected. ${message(e)}`);}finally{clearTimeout(timer);}}
 const result=state.kind==='result'?state.result:null;const active=screen==='home'?'home':['capture','review','analysis'].includes(screen)?'capture':screen;
 if(!loaded&&!fontError)return <View style={s.center}><ActivityIndicator color={c.blue}/><Text>Opening ClimateAdapt…</Text></View>;
 const titles:Record<Screen,string>={home:'ClimateAdapt',capture:'Analyse a photo',review:'Review your evidence',analysis:state.kind==='uploading'?'Analysing observation':state.kind==='failed'?'Connection interrupted':result?.status==='needs_review'?'A closer look':'Evidence results',setup:'Settings',explore:'Explore locations',planning:'Planning',reports:'Evidence summaries'};
 return <SafeAreaView style={s.safe} edges={['top','bottom']}><StatusBar style="dark"/>
 <View style={s.header}>{screen!=='home'&&<Pressable accessibilityRole="button" accessibilityLabel="Back to Home" style={s.iconButton} onPress={()=>go('home')}><Icon name="back"/></Pressable>}<Text style={[s.headerTitle,screen==='home'&&{color:c.blue}]}>{titles[screen]}</Text>{screen!=='setup'&&<Pressable accessibilityRole="button" accessibilityLabel="Open settings" style={s.settingsButton} onPress={()=>go('setup')}><Icon name="settings"/></Pressable>}</View>
 <ScrollView ref={scroll} style={{flex:1}} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
 {notice!==''&&<View accessibilityLiveRegion="polite"><Card title="A quick update" body={notice} tone="sand"/></View>}
 {screen==='home'&&<View style={s.homeLayout}>
 <View style={s.homeIntro}><Text style={s.homeEyebrow}>A CLEARER VIEW</Text><Text style={s.homeTitle}>Understand your{`\n`}surroundings.</Text><Text style={s.homeDescription}>Explore a location or analyse an outdoor photo.</Text></View>
 <View style={s.primaryAction}><View style={s.actionIcon}><Icon name="capture"/></View><Text style={s.actionTitle}>Start with a photo</Text><Text style={s.actionBody}>Take a photo or choose one from your gallery to review visible conditions.</Text><Button title="Analyse a photo" onPress={()=>go('capture')}/></View>
 <Pressable accessibilityRole="button" accessibilityLabel="Explore a location. Search a place and view location screening." onPress={()=>go('explore')} style={({pressed})=>[s.exploreAction,pressed&&{opacity:0.86}]}>
 <LiveCoast height={112}/><View style={s.exploreBody}><View style={s.actionHeading}><Text style={s.actionTitle}>Explore a location</Text><Text style={s.actionArrow} accessible={false}>→</Text></View><Text style={s.actionBody}>Search a place and check the surrounding area.</Text></View>
 </Pressable>
 <Text style={s.homeFootnote}>Preliminary observations for human review.</Text>
 </View>}

 {screen==='capture'&&<><Text style={s.eyebrow}>PHOTO + OPTIONAL LOCATION + TIME</Text>
 <Card title="You choose what to share" body={photoBackend==='mock'?'Choosing a photo starts privacy checking on this phone. Review the covered preview before analysis. After you tap Analyse, the reviewed photo, notes and optional location go to the configured demo server. Its results are fixed examples.':'Choosing or taking a photo checks faces and number plates on this phone. Review the covers before continuing. Only the reviewed image is uploaded. After you tap Analyse, Gemma receives the reviewed image, with notes and optional GPS sent separately. GPS is used only for separate location screening. Temporary server upload files are closed after processing; no photo archive is created.'} tone="mint"/>
 <View accessible accessibilityLabel="Animated coastal illustration, not a field photograph"><LiveCoast height={225}/></View><Text style={s.caption}>Illustrative camera preview · not a field photo</Text>
 <Card title="A useful photo shows context" body="Include the ground, drainage and surroundings. Keep yourself safe and avoid identifying details." tone="mint"/><View style={s.spacer}/>
 <Button title={busy?'Preparing photo…':'Take a photo'} onPress={()=>void choose(true)} disabled={busy}/><Button title="Choose from gallery" secondary onPress={()=>void choose(false)} disabled={busy}/><Button title="Not now — return Home" secondary onPress={()=>go('home')}/></>}
 {screen==='review'&&photo&&<><Text style={s.eyebrow}>STEP 2 · CONFIRM</Text><Image source={{uri:photo.uri}} style={[s.reviewImage,{height:undefined,aspectRatio:photo.width/photo.height}]} contentFit="contain" cachePolicy="none" accessibilityLabel="Your selected photograph, not yet analysed"/><Text style={s.caption}>{photo.width} × {photo.height} · {Math.round(photo.bytes/1024)} KB JPEG{photo.originalBytes?` · original ${Math.round(photo.originalBytes/1024)} KB`:''}</Text>{privacyChecking?<View accessibilityLiveRegion="polite"><Card title="Checking private details…" body="Finding faces and number plates on this phone. Your covered preview will open automatically." tone="mint"/><Button title="Cancel privacy check" secondary onPress={()=>privacyRequest.current?.abort()}/></View>:<><Text style={s.caption}>{photo.privacy==='reviewed'?'Privacy review complete. Only this reviewed image will be analysed.':'Privacy review is needed before analysis.'}</Text><Button title={photo.privacy==='reviewed'?'Review privacy again':'Open privacy preview'} secondary onPress={()=>void scanPrivacy()} disabled={busy}/></>}<Card title={location?'Location ready to share':'Location is optional'} body={location?`${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}. These coordinates will be sent with this observation.`:'No location is attached. You can still send the photograph.'} tone="mint"/><Button title={location?'Remove attached location':'Add my current location'} secondary onPress={()=>location?setLocation(null):void addLocation()} disabled={busy}/><Text style={s.cardTitle}>Observation notes (optional)</Text><Text style={s.caption}>Notes are kept with this temporary observation, but are not passed as instructions to the vision model.</Text><TextInput accessibilityLabel="Observation notes" placeholder="What did you notice?" placeholderTextColor={c.muted} multiline maxLength={500} value={notes} onChangeText={setNotes} style={s.input}/><Card title="Two separate checks" body="Photo observations and location susceptibility are separate evidence. Neither establishes flood probability." tone="blueTint"/><Text style={s.caption}>Temporary app copies are removed when discarded or on restart. Nothing is added to your gallery.</Text><View style={s.spacer}/><Button title="Analyse observation" onPress={()=>void submit()} disabled={busy||!canAnalysePhoto(photo,!!privacyScan)}/><Button title="Choose another photo" secondary onPress={()=>go('capture')}/><Button title="Discard photo" secondary onPress={()=>void clearPhoto().then(()=>go('home'))}/></>}
 {screen==='analysis'&&state.kind==='uploading'&&<View style={s.analysisWaiting}>
 {photo&&<ScanningPhoto key={photo.uri} uri={photo.uri}/>}
 <View style={s.analysisStatus} accessibilityLiveRegion="polite"><Text style={s.analysisTitle}>{photoBackend==='mock'?'Running photo demo…':'Analysing your image…'}</Text><Text style={s.analysisHint}>{seconds>=15?'Still analysing. You can cancel and return to your photo.':'This may take a moment.'}</Text></View>
 <Pressable accessibilityRole="button" accessibilityLabel="Cancel waiting and return to photo" onPress={()=>{cancel();setScreen('review');}} style={({pressed})=>[s.cancelWaiting,pressed&&{opacity:0.65}]}><Text style={s.cancelWaitingText}>Cancel</Text></Pressable>
 </View>}

 {screen==='analysis'&&state.kind==='failed'&&<><Text style={s.eyebrow}>NO RESULT AVAILABLE</Text><View style={s.spacer}/><Text style={s.display}>Let’s try{`\n`}that again.</Text><View accessibilityLiveRegion="assertive"><Card title="The request did not complete" body={state.message} tone="sand"/></View><Card title="Your photo is still here" body="The temporary preview remains on this device. You can review or discard it. Cancelling waiting does not guarantee cancellation of server work." tone="blueTint"/><View style={s.spacer}/>{state.retryable&&<Button title="Try again" onPress={()=>void submit()}/>}<Button title="Review the photo" secondary onPress={()=>go('review')}/><Button title="Check prototype setup" secondary onPress={()=>go('setup')}/></>}
 {screen==='analysis'&&state.kind==='result'&&<>
 {photo&&<Image source={{uri:photo.uri}} style={s.reviewImage} contentFit="contain" cachePolicy="none" accessibilityLabel="Selected photo for comparison with the model observations"/>}
 <PhotoFindings result={state.result}/>
 <Text style={s.caption}>Completed in {(state.elapsedMs/1000).toFixed(2)}s · {Math.round((photo?.bytes||0)/1024)} KB sent</Text>
 <View style={s.spacer}/><Button title="Keep summary for this session" onPress={()=>{setSummaries(items=>items.some(x=>x.requestId===state.result.requestId)?items:[state.result,...items]);go('reports');}}/><Button title="Take another photo" secondary onPress={()=>go('capture')}/><Button title="Discard photo and go Home" secondary onPress={()=>void clearPhoto().then(()=>go('home'))}/></>}
 {screen==='setup'&&<><Card title="On-device privacy" body="Faces and number plates are checked and covered on this phone. No privacy backend address is needed. This feature requires the new Android build." tone="mint"/><Button title="Evaluation controls" secondary onPress={()=>setEvaluationOpen(true)}/><Button title={`Session summaries${summaries.length?` (${summaries.length})`:''}`} secondary onPress={()=>go('reports')}/><Text style={s.caption}>Summaries are kept only until the app restarts. Photos are not archived.</Text><Card title="Connect photo analysis" body="Use Script 55 on your laptop for local Gemma photo analysis. You can also connect the original mock backend for failure demonstrations. Explore has a separate location-service connection." tone="blueTint"/>
 <Text style={s.cardTitle}>Photo backend address</Text><TextInput autoCapitalize="none" autoCorrect={false} keyboardType="url" value={address} onChangeText={setAddress} style={s.input} accessibilityLabel="Photo backend base address"/>
 <Text style={s.caption}>Use your laptop’s Wi-Fi IPv4 address, for example http://192.168.1.20:8080. Expo loads the app on port 8082; it is a different service.</Text>
 <Button title="Check connection and apply" onPress={()=>void check()}/><Text accessibilityLiveRegion="polite" style={s.body}>{health}</Text>
 {photoBackend==='mock'&&<><Text style={s.cardTitle}>Response to demonstrate</Text>{modes.map(m=><Pressable key={m} accessibilityRole="radio" accessibilityLabel={labels[m]} accessibilityState={{checked:mode===m}} onPress={()=>setMode(m)} style={[s.mode,mode===m&&{backgroundColor:c.blueTint,borderColor:c.blue}]}><Text style={s.body}>{mode===m?'●':'○'}  {labels[m]}</Text></Pressable>)}</>}
 {photoBackend==='live_vision'&&<Card title="Real local model connected" body="Photo findings require human review. No calibrated image-confidence percentage is supplied. GPS screening may be unavailable outside the prepared Nelson data." tone="mint"/>}
 <Button title={photo?'Return to photo review':'Capture evidence'} secondary onPress={()=>go(photo?'review':'capture')}/></>}
 {screen==='explore'&&<PlaceWorkspace base={placesBase} onBaseChange={setPlacesBase}/>}
 {screen==='planning'&&<><Text style={s.display}>From evidence{`\n`}to a next step.</Text><Card title="Planning workspace" body="Review findings with an authorised person before making decisions. Recommendations and the planning service will be connected later." tone="mint"/><Button title="Capture an observation" onPress={()=>go('capture')}/></>}
 {screen==='reports'&&<><Text style={s.display}>Your evidence{`\n`}at a glance.</Text><Text style={s.body}>Only summaries you choose to keep appear here. They stay in memory for this session; no photos are saved in this list.</Text>{summaries.length===0?<Card title="No summaries yet" body="Complete a request and choose Keep summary for this session." tone="blueTint"/>:summaries.map(r=><Card key={r.requestId} title={r.label} body={r.demo?`${Math.round(r.confidence*100)}% demo confidence · ${r.status==='needs_review'?'Needs review':'Human review required'}`:`${r.model} · Human review required. ${r.summary}`} tone={r.status==='needs_review'?'sand':'mint'}/>)}{summaries.length>0&&<Button title="Clear session summaries" secondary onPress={()=>setSummaries([])}/>}<Button title="New observation" onPress={()=>go('capture')}/></>}
 </ScrollView>{privacyScan&&photo&&<PrivacyMaskEditor key={photo.uri} uri={photo.uri} scan={privacyScan} onClose={()=>{privacyReviewSource.current=null;setPrivacyScan(null);}} onApply={masked=>void acceptMasked(masked,photo.uri,privacyScan.source_sha256)}/>}<View style={s.nav}>{(['home','explore','capture'] as const).map(tab=><Pressable key={tab} onPress={()=>go(tab)} accessibilityRole="tab" accessibilityLabel={tab} accessibilityState={{selected:active===tab}} style={[s.tab,active===tab&&{backgroundColor:c.blueTint}]}><Icon name={tab}/><Text style={[s.navText,active===tab&&{color:c.blue}]}>{tab[0].toUpperCase()+tab.slice(1)}</Text></Pressable>)}</View>{evaluationState.active&&<Button title={'Evaluation · '+(evaluationState.task||'choose task')} secondary onPress={()=>setEvaluationOpen(true)}/>}<EvaluationPanel onFinishTask={()=>{cancel();go('home');}} visible={evaluationOpen} onClose={()=>setEvaluationOpen(false)} onStartTask={()=>{go('home');setEvaluationOpen(false);}}/></SafeAreaView>;
}
export default function App(){return <SafeAreaProvider><Content/></SafeAreaProvider>;}
const s=StyleSheet.create({scanFrame:{width:'100%',height:260,borderRadius:28,overflow:'hidden',backgroundColor:c.blueTint,borderWidth:1,borderColor:'#D9E4F5'},scanSweep:{position:'absolute',left:0,right:0,top:0,height:32},scanGlow:{position:'absolute',left:0,right:0,top:0,height:32,backgroundColor:'rgba(54,83,255,0.10)',borderRadius:16},scanLine:{position:'absolute',left:12,right:12,top:15,height:2,borderRadius:2,backgroundColor:c.blue},analysisWaiting:{flexGrow:1,justifyContent:'center',gap:24,paddingVertical:24},analysisStatus:{alignItems:'center',gap:10,paddingHorizontal:12},analysisTitle:{fontFamily:fonts.bold,fontSize:23,lineHeight:32,color:c.ink,textAlign:'center'},analysisHint:{fontFamily:fonts.body,fontSize:14,lineHeight:22,color:c.muted,textAlign:'center'},cancelWaiting:{minHeight:48,minWidth:100,alignSelf:'center',paddingHorizontal:24,paddingVertical:12,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:c.white,borderWidth:1,borderColor:'#D9E4F5'},cancelWaitingText:{fontFamily:fonts.semi,fontSize:14,lineHeight:22,color:c.blue},homeLayout:{gap:20,paddingTop:12},homeIntro:{gap:12},homeEyebrow:{fontFamily:fonts.bold,fontSize:11,letterSpacing:1.8,color:c.teal},homeTitle:{fontFamily:fonts.display,fontSize:32,lineHeight:40,color:c.ink},homeDescription:{fontFamily:fonts.body,fontSize:15,lineHeight:24,color:c.muted,maxWidth:340},primaryAction:{padding:22,borderRadius:28,backgroundColor:c.white,gap:12,borderWidth:1,borderColor:'#E3E8F4'},actionIcon:{width:48,height:48,borderRadius:16,backgroundColor:c.blueTint,alignItems:'center',justifyContent:'center',marginBottom:2},actionTitle:{fontFamily:fonts.bold,fontSize:19,lineHeight:26,color:c.ink,flexShrink:1},actionBody:{fontFamily:fonts.body,fontSize:14,lineHeight:22,color:c.muted},exploreAction:{borderRadius:26,overflow:'hidden',backgroundColor:c.mint,borderWidth:1,borderColor:'#C8EBDF'},exploreImage:{height:112,width:'100%'},exploreBody:{padding:20,gap:6},actionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},actionArrow:{fontFamily:fonts.bold,fontSize:24,color:c.teal},homeFootnote:{fontFamily:fonts.body,fontSize:12,lineHeight:18,color:c.muted,textAlign:'center',paddingHorizontal:12},settingsButton:{width:46,height:46,borderRadius:16,backgroundColor:c.white,alignItems:'center',justifyContent:'center'},safe:{flex:1,backgroundColor:c.bg},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:c.bg},header:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,minHeight:56,gap:4},headerTitle:{flex:1,fontFamily:fonts.bold,fontSize:18,color:c.ink},iconButton:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},smallLink:{fontFamily:fonts.bold,color:c.blue,fontSize:12},content:{padding:20,gap:10,flexGrow:1,paddingBottom:24,width:'100%',maxWidth:640,alignSelf:'center'},display:{fontFamily:fonts.display,fontSize:34,lineHeight:42,color:c.ink},body:{fontFamily:fonts.body,fontSize:14,lineHeight:22,color:c.muted},caption:{fontFamily:fonts.semi,fontSize:11,lineHeight:16,color:c.muted},eyebrow:{fontFamily:fonts.semi,fontSize:11,lineHeight:16,color:c.blue},card:{padding:16,borderRadius:20,backgroundColor:c.white,gap:8},cardTitle:{fontFamily:fonts.bold,fontSize:14,lineHeight:20,color:c.ink},row:{flexDirection:'row',alignItems:'center',gap:12},hero:{height:150,borderRadius:28,overflow:'hidden'},heroOverlay:{position:'absolute',left:12,right:12,bottom:12,padding:16,borderRadius:20,backgroundColor:'rgba(11,36,65,0.94)',gap:4},captureImage:{height:225,width:'100%',borderRadius:28},reviewImage:{height:205,width:'100%',borderRadius:28},spacer:{flexGrow:1,minHeight:12},button:{minHeight:56,paddingHorizontal:20,paddingVertical:16,borderRadius:28,backgroundColor:c.blue,borderBottomWidth:5,borderBottomColor:'#1737AD',alignItems:'center',justifyContent:'center',marginBottom:3},secondary:{backgroundColor:c.mint,borderBottomColor:'#A6DDCC',borderBottomWidth:4},buttonText:{fontFamily:fonts.bold,fontSize:14,lineHeight:20,color:c.white,textAlign:'center'},focus:{outlineColor:c.navy,outlineWidth:3,outlineOffset:2},input:{fontFamily:fonts.body,fontSize:14,lineHeight:22,padding:16,borderRadius:16,borderWidth:1,borderColor:'#B5C3DF',color:c.ink,backgroundColor:c.white,minHeight:56},nav:{flexDirection:'row',gap:4,backgroundColor:c.white,paddingHorizontal:12,paddingVertical:10},tab:{flex:1,minHeight:60,borderRadius:20,alignItems:'center',justifyContent:'center',paddingVertical:8,gap:4},navText:{fontFamily:fonts.semi,fontSize:12,lineHeight:16,color:c.muted},mode:{minHeight:48,padding:14,borderWidth:1,borderColor:'#D6DEF0',borderRadius:16,backgroundColor:c.white}});

