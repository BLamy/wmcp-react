"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useContext } from "react";
import { WebContainerContext } from "@/wmcp/providers/Webcontainer";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  FileText,
  FolderIcon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

interface TestError {
  message: string;
  stack?: string;
  location?: {
    file: string;
    line: number;
    column: number;
  };
}

interface TestResult {
  name: string;
  file: string;
  status: "passed" | "failed" | "skipped";
  duration: number;
  errors: TestError[];
}

interface TestFileResult {
  fileName: string;
  path: string;
  suites: {
    name: string;
    tests: TestResult[];
    nested: {
      name: string;
      tests: TestResult[];
    }[];
  }[];
  summary: TestSummary;
}

interface WebContainerTestsProps {
  onComplete?: (results: Record<string, TestFileResult>) => void;
}

export default function WebContainerTests({
  onComplete,
}: WebContainerTestsProps) {
  const { webContainer } = useContext(WebContainerContext);
  const [testResults, setTestResults] = useState<Record<string, TestFileResult>>({});
  const [testOutput, setTestOutput] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("results");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [detectedRunner, setDetectedRunner] = useState<"jest" | "vitest" | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  
  // Function to detect the test runner from package.json
  const detectTestRunner = useCallback(async () => {
    if (!webContainer) return null;
    
    try {
      // Try to read package.json
      const packageJsonContent = await webContainer.fs.readFile('/package.json', 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      
      // Check dependencies and scripts to detect test runner
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      if (dependencies.jest) {
        return "jest";
      } else if (dependencies.vitest) {
        return "vitest";
      }
      
      // Check scripts as fallback
      if (packageJson.scripts) {
        const testScript = packageJson.scripts.test || "";
        if (testScript.includes("jest")) {
          return "jest";
        } else if (testScript.includes("vitest")) {
          return "vitest";
        }
      }
      
      // Default to Jest if no specific runner detected
      return "jest";
    } catch (error) {
      console.error("Error detecting test runner:", error);
      return "jest"; // Default to Jest
    }
  }, [webContainer]);

  // Parse test results from Jest output
  const parseJestOutput = (output: string): Record<string, TestFileResult> => {
    const results: Record<string, TestFileResult> = {};
    
    // Extract test file paths
    const fileRegex = /PASS|FAIL\s+(.+\.test\.[jt]sx?)/g;
    let match;
    
    const fileMatches = [];
    while ((match = fileRegex.exec(output)) !== null) {
      fileMatches.push({
        status: match[0].startsWith("PASS") ? "passed" : "failed",
        path: match[1]
      });
    }
    
    // Extract test names and statuses
    const testRegex = /(✓|✕|○)\s+(.+?)(?:\s+\((\d+)(?:ms|s)\))?$/gm;
    const testMatches = [];
    while ((match = testRegex.exec(output)) !== null) {
      let status: "passed" | "failed" | "skipped" = "passed";
      if (match[1] === "✕") status = "failed";
      if (match[1] === "○") status = "skipped";
      
      testMatches.push({
        status,
        name: match[2],
        duration: match[3] ? parseInt(match[3], 10) : 0
      });
    }
    
    // Extract error messages
    const errorRegex = /Error:(.+?)(?=\n\s+at|\n\n|$)/gs;
    const errorMatches = [];
    while ((match = errorRegex.exec(output)) !== null) {
      errorMatches.push({
        message: match[1].trim()
      });
    }
    
    // Create structured test results
    for (const fileMatch of fileMatches) {
      const fileName = fileMatch.path.split('/').pop() || fileMatch.path;
      
      if (!results[fileMatch.path]) {
        results[fileMatch.path] = {
          fileName,
          path: fileMatch.path,
          suites: [{
            name: 'Default Suite',
            tests: [],
            nested: []
          }],
          summary: {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0
          }
        };
      }
      
      // Add tests to the file result
      let currentErrorIndex = 0;
      for (const testMatch of testMatches) {
        const testResult: TestResult = {
          name: testMatch.name,
          file: fileMatch.path,
          status: testMatch.status,
          duration: testMatch.duration,
          errors: []
        };
        
        // Add error if test failed
        if (testMatch.status === "failed" && currentErrorIndex < errorMatches.length) {
          testResult.errors.push({
            message: errorMatches[currentErrorIndex].message
          });
          currentErrorIndex++;
        }
        
        results[fileMatch.path].suites[0].tests.push(testResult);
        
        // Update summary
        results[fileMatch.path].summary.total++;
        if (testResult.status === "passed") {
          results[fileMatch.path].summary.passed++;
        } else if (testResult.status === "failed") {
          results[fileMatch.path].summary.failed++;
        } else if (testResult.status === "skipped") {
          results[fileMatch.path].summary.skipped++;
        }
        results[fileMatch.path].summary.duration += testResult.duration;
      }
    }
    
    return results;
  };

  // Parse test results from Vitest output
  const parseVitestOutput = (output: string): Record<string, TestFileResult> => {
    // Vitest output is similar to Jest but with some differences
    // For now, we'll use the same parser with some adjustments
    return parseJestOutput(output);
  };

  const runTests = async () => {
    if (!webContainer || isRunning) return;
    
    setIsRunning(true);
    setTestOutput("");
    
    try {
      // Detect test runner if not already detected
      if (!detectedRunner) {
        const runner = await detectTestRunner();
        setDetectedRunner(runner);
      }
      
      // Determine the command to run based on detected test runner
      const testCommand = detectedRunner === "vitest" ? "vitest" : "jest";
      
      console.log(`Running tests with ${testCommand}...`);
      
      // Run the tests
      const testProcess = await webContainer.spawn("npx", [testCommand, "--verbose"]);
      
      let fullOutput = "";
      
      // Capture the output
      testProcess.output.pipeTo(new WritableStream({
        write(data) {
          fullOutput += data;
          setTestOutput(prev => prev + data);
          
          // Auto-scroll to bottom
          if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
          }
        }
      }));
      
      // Wait for the test process to complete
      await testProcess.exit;
      
      // Parse the results based on the detected test runner
      const parsedResults = detectedRunner === "vitest" 
        ? parseVitestOutput(fullOutput)
        : parseJestOutput(fullOutput);
      
      setTestResults(parsedResults);
      
      // Call the onComplete callback if provided
      if (onComplete) {
        onComplete(parsedResults);
      }
      
      // Set the first file as selected if there are results
      const firstFile = Object.keys(parsedResults)[0];
      if (firstFile && !selectedFile) {
        setSelectedFile(firstFile);
      }
      
    } catch (error) {
      console.error("Error running tests:", error);
      setTestOutput(prev => prev + `\nError: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  };
  
  // Run tests when the WebContainer is ready
  useEffect(() => {
    if (webContainer) {
      detectTestRunner().then(runner => {
        setDetectedRunner(runner);
        // Auto-run tests after detection
        runTests();
      });
    }
  }, [webContainer, detectTestRunner]);
  
  // Helper function to format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };
  
  // Compute overall summary
  const computeOverallSummary = (): TestSummary => {
    const summary: TestSummary = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };
    
    Object.values(testResults).forEach(fileResult => {
      summary.total += fileResult.summary.total;
      summary.passed += fileResult.summary.passed;
      summary.failed += fileResult.summary.failed;
      summary.skipped += fileResult.summary.skipped;
      summary.duration += fileResult.summary.duration;
    });
    
    return summary;
  };
  
  const overallSummary = computeOverallSummary();
  const selectedFileResult = selectedFile ? testResults[selectedFile] : null;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <div className="flex items-center">
          <h3 className="font-semibold mr-4">Test Results</h3>
          {!isRunning && Object.keys(testResults).length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="font-medium">{overallSummary.total}</span> tests
              </div>
              <div className="flex items-center gap-1 text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                <span>{overallSummary.passed}</span>
              </div>
              {overallSummary.failed > 0 && (
                <div className="flex items-center gap-1 text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{overallSummary.failed}</span>
                </div>
              )}
              {overallSummary.skipped > 0 && (
                <div className="flex items-center gap-1 text-amber-500">
                  <Clock className="h-4 w-4" />
                  <span>{overallSummary.skipped}</span>
                </div>
              )}
              <div className="text-muted-foreground">
                {formatDuration(overallSummary.duration)}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={runTests} 
            disabled={isRunning}
            size="sm"
            variant="outline"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Tests
              </>
            )}
          </Button>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="relative top-[1px]"
          >
            <TabsList className="h-8">
              <TabsTrigger value="results" className="text-xs h-7">Results</TabsTrigger>
              <TabsTrigger value="console" className="text-xs h-7">Console</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent 
            value="results" 
            className="h-full p-0 m-0 data-[state=active]:flex"
          >
            {Object.keys(testResults).length > 0 ? (
              <div className="h-full flex overflow-hidden">
                {/* File list sidebar */}
                <div className="w-64 border-r overflow-y-auto">
                  <div className="p-2 border-b">
                    <h4 className="font-medium text-sm">Test Files</h4>
                  </div>
                  <div className="p-2">
                    {Object.values(testResults).map(fileResult => (
                      <div
                        key={fileResult.path}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer text-sm ${
                          selectedFile === fileResult.path
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => setSelectedFile(fileResult.path)}
                      >
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <div className="truncate flex-1">
                          {fileResult.fileName}
                        </div>
                        {fileResult.summary.failed > 0 ? (
                          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">
                            {fileResult.summary.failed}
                          </div>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Test results detail */}
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedFileResult ? (
                    <>
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-1">
                          {selectedFileResult.fileName}
                        </h3>
                        <div className="text-sm text-muted-foreground">
                          {selectedFileResult.path}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{selectedFileResult.summary.total}</span> tests
                          </div>
                          <div className="flex items-center gap-1 text-green-500">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{selectedFileResult.summary.passed}</span>
                          </div>
                          {selectedFileResult.summary.failed > 0 && (
                            <div className="flex items-center gap-1 text-red-500">
                              <AlertCircle className="h-4 w-4" />
                              <span>{selectedFileResult.summary.failed}</span>
                            </div>
                          )}
                          {selectedFileResult.summary.skipped > 0 && (
                            <div className="flex items-center gap-1 text-amber-500">
                              <Clock className="h-4 w-4" />
                              <span>{selectedFileResult.summary.skipped}</span>
                            </div>
                          )}
                          <div className="text-muted-foreground">
                            {formatDuration(selectedFileResult.summary.duration)}
                          </div>
                        </div>
                      </div>
                      
                      {selectedFileResult.suites.map((suite, suiteIndex) => (
                        <div key={`${selectedFileResult.path}-${suiteIndex}`} className="mb-6">
                          <h4 className="font-medium mb-2">
                            {suite.name !== 'Default Suite' ? suite.name : 'Tests'}
                          </h4>
                          
                          <div className="space-y-2">
                            {suite.tests.map((test, testIndex) => (
                              <Collapsible 
                                key={`${selectedFileResult.path}-${suiteIndex}-${testIndex}`}
                                className={`border rounded-md ${
                                  test.status === 'failed' 
                                    ? 'border-red-200 bg-red-50 dark:bg-red-900/10' 
                                    : test.status === 'skipped'
                                      ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/10'
                                      : 'border-green-200 bg-green-50 dark:bg-green-900/10'
                                }`}
                              >
                                <CollapsibleTrigger className="w-full flex items-center justify-between p-3 text-sm">
                                  <div className="flex items-center gap-2">
                                    {test.status === 'passed' && (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    )}
                                    {test.status === 'failed' && (
                                      <AlertCircle className="h-4 w-4 text-red-500" />
                                    )}
                                    {test.status === 'skipped' && (
                                      <Clock className="h-4 w-4 text-amber-500" />
                                    )}
                                    <span>{test.name}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDuration(test.duration)}
                                  </div>
                                </CollapsibleTrigger>
                                
                                {test.errors.length > 0 && (
                                  <CollapsibleContent>
                                    <div className="px-3 pb-3 pt-1 border-t">
                                      {test.errors.map((error, errorIndex) => (
                                        <div key={errorIndex} className="text-sm">
                                          <div className="font-medium text-red-600 dark:text-red-400 mb-1">
                                            Error: {error.message}
                                          </div>
                                          {error.stack && (
                                            <pre className="text-xs overflow-x-auto bg-muted p-2 rounded my-2 max-h-60">
                                              {error.stack}
                                            </pre>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                )}
                              </Collapsible>
                            ))}
                          </div>
                          
                          {/* Nested suites */}
                          {suite.nested.map((nestedSuite, nestedIndex) => (
                            <div key={`${selectedFileResult.path}-${suiteIndex}-nested-${nestedIndex}`} className="ml-6 mt-4 mb-4">
                              <h5 className="font-medium text-sm mb-2">
                                {nestedSuite.name}
                              </h5>
                              
                              <div className="space-y-2">
                                {nestedSuite.tests.map((test, testIndex) => (
                                  <Collapsible
                                    key={`${selectedFileResult.path}-${suiteIndex}-nested-${nestedIndex}-${testIndex}`}
                                    className={`border rounded-md ${
                                      test.status === 'failed' 
                                        ? 'border-red-200 bg-red-50 dark:bg-red-900/10' 
                                        : test.status === 'skipped'
                                          ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/10'
                                          : 'border-green-200 bg-green-50 dark:bg-green-900/10'
                                    }`}
                                  >
                                    <CollapsibleTrigger className="w-full flex items-center justify-between p-3 text-sm">
                                      <div className="flex items-center gap-2">
                                        {test.status === 'passed' && (
                                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        )}
                                        {test.status === 'failed' && (
                                          <AlertCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        {test.status === 'skipped' && (
                                          <Clock className="h-4 w-4 text-amber-500" />
                                        )}
                                        <span>{test.name}</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {formatDuration(test.duration)}
                                      </div>
                                    </CollapsibleTrigger>
                                    
                                    {test.errors.length > 0 && (
                                      <CollapsibleContent>
                                        <div className="px-3 pb-3 pt-1 border-t">
                                          {test.errors.map((error, errorIndex) => (
                                            <div key={errorIndex} className="text-sm">
                                              <div className="font-medium text-red-600 dark:text-red-400 mb-1">
                                                Error: {error.message}
                                              </div>
                                              {error.stack && (
                                                <pre className="text-xs overflow-x-auto bg-muted p-2 rounded my-2 max-h-60">
                                                  {error.stack}
                                                </pre>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </CollapsibleContent>
                                    )}
                                  </Collapsible>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <p>Select a test file to view results</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                {isRunning ? (
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p>Running tests...</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="mb-4 text-muted-foreground">No test results available</p>
                    <Button onClick={runTests}>Run Tests</Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
          
          <TabsContent 
            value="console" 
            className="h-full p-0 m-0 data-[state=active]:flex"
          >
            <div 
              ref={outputRef}
              className="w-full h-full overflow-auto bg-black text-white p-4 font-mono text-sm whitespace-pre-wrap"
            >
              {testOutput || "No output yet. Run tests to see console output."}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}