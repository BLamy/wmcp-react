// icons.tsx
import React from 'react';

// --- Prop Types ---
interface IconProps extends React.SVGProps<SVGSVGElement> {
  isOpen: boolean;
  panelColor?: string;
  contentColor?: string;
  strokeWidth?: number;
  iconBaseX?: number;
  iconBaseY?: number;
  iconWidth?: number;
  iconHeight?: number;
  cornerRadius?: number;
}

interface HorizontalPanelIconProps extends IconProps {
  panelWidth?: number;
}

interface VerticalPanelIconProps extends IconProps {
  panelHeight?: number; // For bottom panel
}

// --- Left Panel Icon ---
export const LeftPanelIcon: React.FC<HorizontalPanelIconProps> = ({
  isOpen,
  panelColor = "#c4c4c4",
  contentColor = "transparent",
  strokeWidth = 1,
  iconBaseX = 3,
  iconBaseY = 2,
  iconWidth = 10,
  iconHeight = 12,
  panelWidth = 4, // Approx 40% of iconWidth
  cornerRadius = 2,
  ...rest
}) => {
  return (
    <svg
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      {...rest}
    >
      <defs>
        <clipPath id="leftPanelClipPathV2">
          <rect
            x={iconBaseX}
            y={iconBaseY}
            width={iconWidth}
            height={iconHeight}
            rx={cornerRadius}
          />
        </clipPath>
      </defs>

      {isOpen ? (
        <>
          <g clipPath="url(#leftPanelClipPathV2)">
            {/* Panel on the left */}
            <rect
              x={iconBaseX}
              y={iconBaseY}
              width={panelWidth}
              height={iconHeight}
              fill={panelColor}
            />
            {/* Content area on the right */}
            <rect
              x={iconBaseX + panelWidth}
              y={iconBaseY}
              width={iconWidth - panelWidth}
              height={iconHeight}
              fill={contentColor}
            />
          </g>
          {/* Add outline for open state */}
          <rect
            x={iconBaseX}
            y={iconBaseY}
            width={iconWidth}
            height={iconHeight}
            rx={cornerRadius}
            fill="none"
            stroke={panelColor}
            strokeWidth={strokeWidth}
          />
        </>
      ) : (
        // Closed state: Outlined
        <g fill="none" stroke={panelColor} strokeWidth={strokeWidth}>
          {/* Outer Frame */}
          <rect
            x={iconBaseX}
            y={iconBaseY}
            width={iconWidth}
            height={iconHeight}
            rx={cornerRadius}
          />
          {/* Dividing Line */}
          <line
            x1={iconBaseX + panelWidth}
            y1={iconBaseY}
            x2={iconBaseX + panelWidth}
            y2={iconBaseY + iconHeight}
          />
        </g>
      )}
    </svg>
  );
};

// --- Bottom Panel Icon ---
export const BottomPanelIcon: React.FC<VerticalPanelIconProps> = ({
  isOpen,
  panelColor = "#c4c4c4",
  contentColor = "#545454",
  strokeWidth = 1,
  iconBaseX = 3,
  iconBaseY = 2,
  iconWidth = 10,
  iconHeight = 12,
  panelHeight = 4, // Approx 1/3 of iconHeight
  cornerRadius = 2,
  ...rest
}) => {
  return (
    <svg
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      {...rest}
    >
      <defs>
        <clipPath id="bottomPanelClipPathV2">
          <rect
            x={iconBaseX}
            y={iconBaseY}
            width={iconWidth}
            height={iconHeight}
            rx={cornerRadius}
          />
        </clipPath>
      </defs>

      {isOpen ? (
        <>
          <g clipPath="url(#bottomPanelClipPathV2)">
            {/* Content area on top */}
            <rect
              x={iconBaseX}
              y={iconBaseY}
              width={iconWidth}
              height={iconHeight - panelHeight}
              fill={contentColor}
            />
            {/* Panel on the bottom */}
            <rect
              x={iconBaseX}
              y={iconBaseY + iconHeight - panelHeight}
              width={iconWidth}
              height={panelHeight}
              fill={panelColor}
            />
          </g>
          {/* Add outline for open state */}
          <rect
            x={iconBaseX}
            y={iconBaseY}
            width={iconWidth}
            height={iconHeight}
            rx={cornerRadius}
            fill="none"
            stroke={panelColor}
            strokeWidth={strokeWidth}
          />
        </>
      ) : (
        // Closed state: Outlined
        <g fill="none" stroke={panelColor} strokeWidth={strokeWidth}>
          {/* Outer Frame */}
          <rect
            x={iconBaseX}
            y={iconBaseY}
            width={iconWidth}
            height={iconHeight}
            rx={cornerRadius}
          />
          {/* Dividing Line */}
          <line
            x1={iconBaseX}
            y1={iconBaseY + iconHeight - panelHeight}
            x2={iconBaseX + iconWidth}
            y2={iconBaseY + iconHeight - panelHeight}
          />
        </g>
      )}
    </svg>
  );
};

// --- Right Panel Icon ---
export const RightPanelIcon: React.FC<HorizontalPanelIconProps> = ({
  isOpen,
  panelColor = "#c4c4c4",
  contentColor = "#545454",
  strokeWidth = 1,
  iconBaseX = 3,
  iconBaseY = 2,
  iconWidth = 10,
  iconHeight = 12,
  panelWidth = 4, // Approx 40% of iconWidth
  cornerRadius = 2,
  ...rest
}) => {
  return (
    <svg
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      {...rest}
    >
      <defs>
        <clipPath id="rightPanelClipPathV2">
          <rect
            x={iconBaseX}
            y={iconBaseY}
            width={iconWidth}
            height={iconHeight}
            rx={cornerRadius}
          />
        </clipPath>
      </defs>

      {isOpen ? (
        <>
          <g clipPath="url(#rightPanelClipPathV2)">
            {/* Content area on the left */}
            <rect
              x={iconBaseX}
              y={iconBaseY}
              width={iconWidth - panelWidth}
              height={iconHeight}
              fill={contentColor}
            />
            {/* Panel on the right */}
            <rect
              x={iconBaseX + iconWidth - panelWidth}
              y={iconBaseY}
              width={panelWidth}
              height={iconHeight}
              fill={panelColor}
            />
          </g>
          {/* Add outline for open state */}
          <rect
            x={iconBaseX}
            y={iconBaseY}
            width={iconWidth}
            height={iconHeight}
            rx={cornerRadius}
            fill="none"
            stroke={panelColor}
            strokeWidth={strokeWidth}
          />
        </>
      ) : (
        // Closed state: Outlined
        <g fill="none" stroke={panelColor} strokeWidth={strokeWidth}>
          {/* Outer Frame */}
          <rect
            x={iconBaseX}
            y={iconBaseY}
            width={iconWidth}
            height={iconHeight}
            rx={cornerRadius}
          />
          {/* Dividing Line */}
          <line
            x1={iconBaseX + iconWidth - panelWidth}
            y1={iconBaseY}
            x2={iconBaseX + iconWidth - panelWidth}
            y2={iconBaseY + iconHeight}
          />
        </g>
      )}
    </svg>
  );
};

// Example of how you might use them (in another file, e.g., App.tsx):
/*
import React, { useState } from 'react';
import { LeftPanelIcon, BottomPanelIcon, RightPanelIcon } from './icons';

const App: React.FC = () => {
  const [showLeft, setShowLeft] = useState(true);
  const [showBottom, setShowBottom] = useState(false);
  const [showRight, setShowRight] = useState(true);

  return (
    <div style={{ display: 'flex', gap: '10px', padding: '20px', background: '#333' }}>
      <button onClick={() => setShowLeft(!showLeft)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <LeftPanelIcon isOpen={showLeft} width="32" height="32" />
      </button>
      <button onClick={() => setShowBottom(!showBottom)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <BottomPanelIcon isOpen={showBottom} width="32" height="32" panelHeight={3} />
      </button>
      <button onClick={() => setShowRight(!showRight)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <RightPanelIcon 
          isOpen={showRight} 
          width="32" 
          height="32" 
          panelColor="lightblue" 
          contentColor="darkblue" 
          panelWidth={5}
        />
      </button>
    </div>
  );
};

export default App;
*/

export const FolderIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const FolderOpenIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M5 19a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v1" />
    <path d="M21 19H9a2 2 0 0 1-1.93-1.49L4 10h17l-2.07 7.5A2 2 0 0 1 17 19z" />
  </svg>
);

export const FileIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export const ChevronRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);