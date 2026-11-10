import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { c, fonts } from './theme';

type Props = { visible: boolean; uri: string; onClose: () => void };
type Transform = { zoom: number; x: number; y: number };
type Touch = { pageX: number; pageY: number };
const initial: Transform = { zoom: 1, x: 0, y: 0 };
const minimumZoom = 1;
const maximumZoom = 5;
const limit = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (touches: readonly Touch[]) => touches.length < 2 ? 0 :
  Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
const midpoint = (touches: readonly Touch[]) => ({
  x: touches.reduce((sum, point) => sum + point.pageX, 0) / Math.max(1, touches.length),
  y: touches.reduce((sum, point) => sum + point.pageY, 0) / Math.max(1, touches.length),
});

export default function EvidenceImageViewer({ visible, uri, onClose }: Props) {
  const [transform, setTransform] = useState<Transform>(initial);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const viewport = useRef({ width: 1, height: 1 });
  const imageSize = useRef({ width: 14, height: 11 });
  const current = useRef<Transform>(initial);
  const lastTap = useRef(0);
  const gesture = useRef({ count: 0, distance: 0, middle: { x: 0, y: 0 }, origin: initial, moved: false, pinched: false });

  function apply(next: Transform) {
    const zoom = limit(next.zoom, minimumZoom, maximumZoom);
    const view = viewport.current;
    const image = imageSize.current;
    const fit = Math.min(view.width / image.width, view.height / image.height);
    const maxX = Math.max(0, (image.width * fit * zoom - view.width) / 2);
    const maxY = Math.max(0, (image.height * fit * zoom - view.height) / 2);
    const value = { zoom, x: limit(next.x, -maxX, maxX), y: limit(next.y, -maxY, maxY) };
    current.current = value;
    setTransform(value);
  }

  function rebase(touches: readonly Touch[]) {
    gesture.current.count = touches.length;
    gesture.current.distance = distance(touches);
    gesture.current.middle = midpoint(touches);
    gesture.current.origin = { ...current.current };
    if (touches.length > 1) gesture.current.pinched = true;
  }

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      gesture.current.moved = false;
      gesture.current.pinched = false;
      rebase(event.nativeEvent.touches);
    },
    onPanResponderMove: event => {
      const touches = event.nativeEvent.touches;
      if (!touches.length) return;
      if (touches.length !== gesture.current.count) {
        rebase(touches);
        return;
      }
      const state = gesture.current;
      const middle = midpoint(touches);
      const dx = middle.x - state.middle.x;
      const dy = middle.y - state.middle.y;
      if (Math.abs(dx) + Math.abs(dy) > 6 || touches.length > 1) state.moved = true;
      const zoom = touches.length > 1 && state.distance > 0 ?
        state.origin.zoom * distance(touches) / state.distance : state.origin.zoom;
      apply({ zoom, x: state.origin.x + dx, y: state.origin.y + dy });
    },
    onPanResponderRelease: () => {
      if (!gesture.current.moved && !gesture.current.pinched) {
        const now = Date.now();
        if (lastTap.current > 0 && now - lastTap.current < 300) {
          apply(current.current.zoom > 1 ? initial : { zoom: 2.5, x: 0, y: 0 });
          lastTap.current = 0;
        } else lastTap.current = now;
      } else lastTap.current = 0;
      gesture.current.count = 0;
    },
    onPanResponderTerminate: () => {
      gesture.current.count = 0;
      lastTap.current = 0;
    },
    onPanResponderTerminationRequest: () => false,
  })).current;

  useEffect(() => {
    current.current = initial;
    setTransform(initial);
    setLoading(true);
    setFailed(false);
    imageSize.current = { width: 14, height: 11 };
    lastTap.current = 0;
  }, [visible, uri]);

  function zoomBy(amount: number) {
    apply({ ...current.current, zoom: current.current.zoom + amount });
  }

  // Zoom controls remain available for users who cannot use pinch gestures.
  function control(label: string, text: string, action: () => void, disabled = false) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      disabled={disabled} onPress={action} style={({ pressed }) => [s.control, disabled && s.disabled, pressed && s.pressed]}>
      <Text style={s.controlText}>{text}</Text>
    </Pressable>;
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Text style={s.title}>Screening evidence</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close enlarged image" onPress={onClose} style={s.close}>
            <Text style={s.closeText}>Close</Text>
          </Pressable>
        </View>
        <View style={s.viewport} onLayout={event => {
          viewport.current = event.nativeEvent.layout;
          apply(current.current);
        }}>
          {!failed && <View style={StyleSheet.absoluteFill} {...responder.panHandlers} accessible accessibilityRole="image"
            accessibilityLabel="Area evidence showing elevation, susceptibility score, flagged land and coast distance. Use the controls below to zoom.">
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
              transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.zoom }],
            }]}>
              <Image key={`${uri}-${retry}`} source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="none" accessible={false}
                onLoad={event => {
                  if (event.source.width > 0 && event.source.height > 0) imageSize.current = event.source;
                  apply(current.current);
                  setLoading(false);
                }}
                onError={() => { setFailed(true); setLoading(false); }} />
            </View>
          </View>}
          {loading && !failed && <View pointerEvents="none" style={s.loading}>
            <ActivityIndicator color={c.blue} size="large" />
            <Text style={s.hint}>Loading evidence image…</Text>
          </View>}
          {failed && <View style={s.loading}>
            <Text style={s.error}>The image could not load. Your screening results are still available.</Text>
            {control('Retry loading image', 'Try again', () => { setFailed(false); setLoading(true); setRetry(value => value + 1); })}
          </View>}
        </View>
        <View style={s.footer}>
          <Text style={s.hint}>Pinch to zoom · drag to move · double-tap to reset or enlarge</Text>
          <View style={s.controls}>
            {control('Zoom out', '−', () => zoomBy(-0.5), failed || loading || transform.zoom <= minimumZoom)}
            <Text style={s.zoomLabel}>{transform.zoom.toFixed(1)}×</Text>
            {control('Zoom in', '+', () => zoomBy(0.5), failed || loading || transform.zoom >= maximumZoom)}
            {control('Reset image zoom', 'Reset', () => apply(initial), failed || loading)}
          </View>
          <Text style={s.disclaimer}>Preliminary screening · human review required</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.white },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, color: c.ink },
  close: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 24, backgroundColor: c.blueTint },
  closeText: { fontFamily: fonts.bold, fontSize: 14, color: c.blue },
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: '#F5F7FC' },
  loading: {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  gap: 18,
},
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 19, color: c.muted, textAlign: 'center' },
  error: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: c.ink, textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 14 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  control: { minWidth: 48, minHeight: 48, paddingHorizontal: 16, borderRadius: 20, backgroundColor: c.blueTint, alignItems: 'center', justifyContent: 'center' },
  controlText: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: c.blue },
  zoomLabel: { minWidth: 40, fontFamily: fonts.semi, fontSize: 14, color: c.ink, textAlign: 'center' },
  disclaimer: { fontFamily: fonts.body, fontSize: 11, lineHeight: 17, color: c.muted, textAlign: 'center' },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.4 },
});
