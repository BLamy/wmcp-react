import React from 'react';

/**
 * Enhanced CSS styles for the debugger highlight
 */
const DebuggerStyles: React.FC = () => (
  <style>
    {`
    /* Debugger highlight - stronger, more visible styling */
    .cm-debugger-highlight {
      background-color: rgba(0, 122, 204, 0.6) !important;
      border-left: 4px solid rgb(0, 122, 255) !important;
      box-shadow: inset 0 0 0 1px rgba(0, 122, 255, 0.5);
      border-radius: 2px;
      position: relative;
      z-index: 5;
    }
    
    /* Make sure the highlight is visible in dark themes */
    .cm-line .cm-debugger-highlight {
      color: white !important;
      font-weight: 500;
    }
    
    /* Timeline styles */
    .timeline-track {
      display: flex;
      width: 100%;
      height: 4px;
      background-color: #3c3c3c;
      margin: 4px 0;
    }
    
    .timeline-point {
      flex: 1;
      height: 100%;
      margin: 0 1px;
      background-color: #555;
      cursor: pointer;
    }
    
    .timeline-point.active {
      background-color: #0078d7;
    }
    `}
  </style>
);

export default DebuggerStyles; 