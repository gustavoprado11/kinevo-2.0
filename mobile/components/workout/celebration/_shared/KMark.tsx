import React from 'react';
import { Image } from 'react-native';

const LOGO = require('../../../../assets/images/logo-icon.jpg');

export function KMark({ size = 20 }: { size?: number }) {
  return <Image source={LOGO} style={{ width: size, height: size, borderRadius: size * 0.26 }} resizeMode="cover" />;
}
