import React from 'react';

const createMockComponent = (name: string) => {
  const Component = React.forwardRef((props: any, ref: any) =>
    React.createElement(name, { ...props, ref })
  );
  Component.displayName = name;
  return Component;
};

export const Svg = createMockComponent('Svg');
export const Circle = createMockComponent('Circle');
export const Ellipse = createMockComponent('Ellipse');
export const G = createMockComponent('G');
export const Text = createMockComponent('SvgText');
export const TSpan = createMockComponent('TSpan');
export const TextPath = createMockComponent('TextPath');
export const Path = createMockComponent('Path');
export const Polygon = createMockComponent('Polygon');
export const Polyline = createMockComponent('Polyline');
export const Line = createMockComponent('Line');
export const Rect = createMockComponent('Rect');
export const Use = createMockComponent('Use');
export const Image = createMockComponent('SvgImage');
export const Symbol = createMockComponent('SvgSymbol');
export const Defs = createMockComponent('Defs');
export const LinearGradient = createMockComponent('LinearGradient');
export const RadialGradient = createMockComponent('RadialGradient');
export const Stop = createMockComponent('Stop');
export const ClipPath = createMockComponent('ClipPath');
export const Pattern = createMockComponent('Pattern');
export const Mask = createMockComponent('Mask');
export const ForeignObject = createMockComponent('ForeignObject');
export const Marker = createMockComponent('Marker');
export const SvgFromUri = createMockComponent('SvgFromUri');
export const SvgFromXml = createMockComponent('SvgFromXml');
export const SvgXml = createMockComponent('SvgXml');
export const SvgUri = createMockComponent('SvgUri');
export const SvgCss = createMockComponent('SvgCss');
export const SvgCssUri = createMockComponent('SvgCssUri');
export const parse = jest.fn();

export default Svg;
