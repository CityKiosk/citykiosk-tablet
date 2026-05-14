"use client";

import { forwardRef, ReactNode } from "react";
import HTMLFlipBook from "react-pageflip";

// react-pageflip requires forwardRef children for page detection
export const FlipPage = forwardRef<HTMLDivElement, { children: ReactNode; className?: string; isActive?: boolean }>(
  function FlipPage({ children, className, isActive = true }, ref) {
    return (
      <div ref={ref} className={className} aria-hidden={!isActive} inert={!isActive || undefined}>
        {children}
      </div>
    );
  }
);

type FlipbookProps = {
  width: number;
  height: number;
  children: ReactNode;
  onFlip?: (pageIndex: number) => void;
  flipRef?: React.Ref<unknown>;
};

export default function Flipbook({ width, height, children, onFlip, flipRef }: FlipbookProps) {
  return (
    <HTMLFlipBook
      ref={flipRef}
      width={width}
      height={height}
      size="stretch"
      minWidth={300}
      maxWidth={1200}
      minHeight={425}
      maxHeight={1700}
      drawShadow={true}
      flippingTime={400}
      showCover={false}
      mobileScrollSupport={true}
      usePortrait={true}
      startPage={0}
      maxShadowOpacity={0.4}
      useMouseEvents={true}
      clickEventForward={false}
      swipeDistance={30}
      showPageCorners={true}
      disableFlipByClick={false}
      autoSize={true}
      startZIndex={0}
      onFlip={(e: { data: number }) => onFlip?.(e.data)}
      className=""
      style={{}}
    >
      {children}
    </HTMLFlipBook>
  );
}
