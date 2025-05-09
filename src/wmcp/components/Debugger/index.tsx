"use client";

import React, { useContext, useEffect, useState } from "react";
import { WebContainerContext } from "@/wmcp/providers/Webcontainer";
import DumbDebugger, { DumbFileMap } from "./DumbDebugger";

/**
 * Custom hook that handles WebContainer integration for the debugger
 */
const useWebcontainerDebugger = () => {
  const { webContainer, status: webContainerStatus } = useContext(WebContainerContext);
  
  const [files, setFiles] = useState<DumbFileMap>({});
  const [debugSteps, setDebugSteps] = useState<Record<string, any>>({});
  const [status, setStatus] = useState({ text: "Booting Webcontainer...", color: "#3BB446" });
  const [stats, setStats] = useState({ total: 0, passing: 0, time: "--" });
  const [testStatuses, setTestStatuses] = useState<Record<string, "passed" | "failed" | "unknown">>({});

  // Update status based on webContainer status
  useEffect(() => {
    switch (webContainerStatus) {
      case "booting":
      case "none":
        setStatus({ text: "Booting Webcontainer...", color: "#E0AF0B" });
        break;
      case "installing":
      case "mounting":
        setStatus({ text: "Installing node_modules...", color: "#E0AF0B" });
        break;
      case "error":
        setStatus({ text: "Error", color: "#E74C3C" });
        break;
    }
  }, [webContainerStatus]);

  // Initialize files
  useEffect(() => {
    if (webContainerStatus === "ready" && webContainer) {
      // Initialize with available JS files
      const loadFiles = async () => {
        const availableFiles = ['index.js', 'index.test.js'];
        const fileMap: DumbFileMap = {};
        
        for (const fileName of availableFiles) {
          try {
            const content = await webContainer.fs.readFile(`/${fileName}`, 'utf-8');
            fileMap[fileName] = { file: { contents: content } };
          } catch (err) {
            console.error(`Failed to read ${fileName}:`, err);
            fileMap[fileName] = { file: { contents: `// Error loading ${fileName}` } };
          }
        }
        
        setFiles(fileMap);
      };
      
      loadFiles();
    }
  }, [webContainer, webContainerStatus]);

  // Run tests & collect debug data
  useEffect(() => {
    if (!webContainer || webContainerStatus !== "ready") return;
    
    const runTests = async () => {
      setStatus({ text: "Running tests…", color: "#E0AF0B" });
      const t0 = performance.now();
      const proc = await webContainer.spawn("npm", ["test"]);
      await proc.exit;
      const dt = Math.round(performance.now() - t0);
      
      // First load all test files to display in the editor
      try {
        const availableFiles = ['index.js', 'index.test.js'];
        const fileMap: DumbFileMap = {};
        
        for (const fileName of availableFiles) {
          try {
            const content = await webContainer.fs.readFile(`/${fileName}`, 'utf-8');
            fileMap[fileName] = { file: { contents: content } };
          } catch (err) {
            console.error(`Failed to read ${fileName}:`, err);
          }
        }
        
        setFiles(fileMap);
      } catch (err) {
        console.error("Failed to load test files:", err);
      }

      // Read the coverage report to get test statuses
      try {
        const coverageReportPath = '/.blamy/coverage/vitest-coverage.json';
        const coverageContent = await webContainer.fs.readFile(coverageReportPath, 'utf-8');
        const coverageData = JSON.parse(coverageContent);
        
        // Build a map of test statuses
        const testStatusMap: Record<string, "passed" | "failed" | "unknown"> = {};
        
        if (coverageData && coverageData.testResults) {
          let totalTests = 0;
          let passingTests = 0;
          
          coverageData.testResults.forEach((result: any) => {
            if (result.assertionResults) {
              result.assertionResults.forEach((assertion: any) => {
                // Use the full test path as the key
                const filePath = result.name.split('/').pop()?.replace('.test.js', '') || '';
                const ancestors = assertion.ancestorTitles || [];
                const testName = assertion.title;
                
                // Create a key with the full path structure (matching fixture format)
                // Format: 'math.spec / Math / add / adds numbers'
                const fileName = `${filePath}.spec`;
                const fullPath = `${fileName} / ${ancestors.join(' / ')} / ${testName}`;
                const status = assertion.status === 'passed' ? 'passed' : 'failed';
                
                testStatusMap[fullPath] = status;
                
                totalTests++;
                if (status === 'passed') passingTests++;
              });
            }
          });
          
          setStats({
            total: totalTests,
            passing: passingTests,
            time: `${dt}ms`
          });
        }
        
        setTestStatuses(testStatusMap);
      } catch (err) {
        console.error("Failed to read coverage report:", err);
      }

      // collect debug data with proper formatting to match fixtures structure
      try {
        const dirs = await webContainer.fs.readdir("/.timetravel", {
          withFileTypes: true,
        });

        // Recursive function to find leaf directories (containing only files)
        const findLeafDirs = async (path: string): Promise<string[]> => {
          const entries = await webContainer.fs.readdir(path, {
            withFileTypes: true,
          });

          const subdirs = entries.filter((entry: any) => entry.isDirectory());

          // If no subdirectories, this is a leaf directory
          if (subdirs.length === 0) {
            return [path];
          }

          // Otherwise, recursively check all subdirectories
          const results: string[] = [];
          for (const dir of subdirs) {
            const subpath = `${path}/${dir.name}`;
            const leafDirs = await findLeafDirs(subpath);
            results.push(...leafDirs);
          }

          return results.filter((dir: string) => !dir.includes("UnknownTest"));
        };

        // Find all leaf directories and process them
        const leafDirs = await findLeafDirs("/.timetravel");

        // We'll build a structure: { [fileName]: { [describeBlock]: { [testName]: steps[] } } }
        // For example: { "odata.spec.js": { "parseODataQuery": { "should parse $filter": [...] } } }
        const debugStepsByFile: Record<string, Record<string, Record<string, any[]>>> = {};

        for (const leafDir of leafDirs) {
          // The leafDir path is like "/.timetravel/odata.spec/parseODataQuery/should parse $filter"
          const parts = leafDir.split('/').filter(Boolean);
          // Find the last three parts: [fileName, describeBlock, testName]
          // e.g. ["odata.spec", "parseODataQuery", "should parse $filter"]
          const [fileName, describeBlock, testName] = parts.slice(-3);

          if (!fileName || !describeBlock || !testName) continue;

          // Use correct extension to match fixture format (.js not .spec.js)
          const fileKey = `${fileName}.js`;

          // Read all files in the leaf directory
          const files = await webContainer.fs.readdir(leafDir, {
            withFileTypes: true,
          });

          for (const file of files) {
            try {
              const filePath = `${leafDir}/${file.name}`;
              const content = await webContainer.fs.readFile(filePath, 'utf-8');
              try {
                const jsonData = JSON.parse(content);
                // Ensure structure exists
                if (!debugStepsByFile[fileKey]) debugStepsByFile[fileKey] = {};
                if (!debugStepsByFile[fileKey][describeBlock]) debugStepsByFile[fileKey][describeBlock] = {};
                if (!debugStepsByFile[fileKey][describeBlock][testName]) debugStepsByFile[fileKey][describeBlock][testName] = [];
                
                // Ensure each step has a file property that matches the file key
                const stepWithFile = {
                  ...jsonData,
                  file: fileKey,
                  line: jsonData.line || 1, // Ensure line exists
                  vars: jsonData.vars || {} // Ensure vars exists
                };
                
                debugStepsByFile[fileKey][describeBlock][testName].push(stepWithFile);
              } catch (parseErr) {
                console.warn(`Could not parse ${file.name} as JSON:`, parseErr);
              }
            } catch (readErr) {
              console.error(`Failed to read file ${file.name}:`, readErr);
            }
          }
        }

        // Sort steps by stepNumber and ensure file property matches files object keys
        const groupedDebugSteps: Record<string, any> = {};
        for (const [fileName, describeBlocks] of Object.entries(debugStepsByFile)) {
          groupedDebugSteps[fileName] = {};
          for (const [describeBlock, tests] of Object.entries(describeBlocks)) {
            groupedDebugSteps[fileName][describeBlock] = {};
            for (const [testName, steps] of Object.entries(tests)) {
              const sortedSteps = steps
                .sort((a: any, b: any) => {
                  const stepA = a.stepNumber !== undefined ? a.stepNumber : 0;
                  const stepB = b.stepNumber !== undefined ? b.stepNumber : 0;
                  return stepA - stepB;
                })
                .map((step: any) => ({
                  ...step,
                  file: fileName, // Keep consistent with the files object keys
                }));
              groupedDebugSteps[fileName][describeBlock][testName] = sortedSteps;
            }
          }
        }

        // Make sure all referenced files in debugSteps exist in the files object
        // If not, load them
        const filesNeeded = new Set<string>();
        Object.keys(groupedDebugSteps).forEach(fileName => {
          filesNeeded.add(fileName);
        });
        
        const filesToLoad = Array.from(filesNeeded).filter(file => !files[file]);
        for (const file of filesToLoad) {
          try {
            const content = await webContainer.fs.readFile(`/${file.replace('.spec.js', '.js')}`, 'utf-8');
            setFiles(prev => ({
              ...prev,
              [file]: { file: { contents: content } }
            }));
          } catch (err) {
            console.error(`Failed to read ${file}:`, err);
            // Create an empty placeholder
            setFiles(prev => ({
              ...prev,
              [file]: { file: { contents: `// File ${file} could not be loaded` } }
            }));
          }
        }

        setDebugSteps(groupedDebugSteps);
        setStatus({ text: "Tests complete", color: "#3BB446" });
      } catch (err) {
        console.error("Failed to read .timetravel directory:", err);
      }
    };

    runTests();
  }, [webContainer, webContainerStatus]);

  // File update handler
  const handleFileUpdate = async (filename: string, content: string) => {
    if (!webContainer) return;
    
    try {
      await webContainer.fs.writeFile(`/${filename}`, content);
      setFiles(prev => ({
        ...prev,
        [filename]: { file: { contents: content } }
      }));
    } catch (err) {
      console.error(`Failed to write ${filename}:`, err);
    }
  };

  return {
    files,
    debugSteps,
    status,
    stats,
    testStatuses,
    handleFileUpdate
  };
};

/**
 * WebContainerDebugger component that uses DumbDebugger for UI
 */
interface WebContainerDebuggerProps {
  // Optional props to override defaults
  files?: DumbFileMap;
  debugSteps?: Record<string, any>;
  testStatuses?: Record<string, "passed" | "failed" | "unknown">;
}

const WebContainerDebugger: React.FC<WebContainerDebuggerProps> = (props) => {
  const { 
    files: filesFromHook, 
    debugSteps: stepsFromHook, 
    status, 
    stats, 
    testStatuses: statusesFromHook,
    handleFileUpdate
  } = useWebcontainerDebugger();

  // Use props if provided, otherwise use data from hook
  const files = props.files || filesFromHook;
  const debugSteps = props.debugSteps || stepsFromHook;
  const testStatuses = props.testStatuses || statusesFromHook;

  // Don't render until we have files
  const hasFiles = Object.keys(files).length > 0;

  return (
    <div className="flex flex-col h-screen w-full bg-[#1e1e1e] text-[#e0e0e0] font-sans">
      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {hasFiles ? (
          <DumbDebugger 
            files={files} 
            debugSteps={debugSteps} 
            testStatuses={testStatuses} 
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-2xl mb-4">Loading files...</div>
              <div className="text-sm text-gray-400">
                Waiting for WebContainer to load test files
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex h-[24px] text-xs px-6 w-full"
        style={{ background: status.color }}
      >
        <div className="flex flex-1 items-center gap-2 ml-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: status.color === "#007acc" ? "#3BB446" : status.color,
            }}
          />
          <span>{status.text}</span>
        </div>

        <div className="opacity-80 flex flex-1 items-center ">
          <span className="w-full text-center">{stats.time}</span>
        </div>

        <div className="flex flex-1 gap-4 items-center justify-end mr-2">
          <span>
            TESTS:&nbsp;<span>{stats.passing}</span>/<span>{stats.total}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default WebContainerDebugger;
