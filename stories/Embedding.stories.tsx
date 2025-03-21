import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';

const useWorker = (workerPath: string) => {
  const [result, setResult] = useState<number[] | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const worker = useRef<Worker | null>(null);

  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(new URL(workerPath, import.meta.url), {
        type: 'module',
      });
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = async (e: MessageEvent) => {
      switch (e.data.status) {
        case 'initiate':
          setReady(false);
          break;
        case 'ready':
          setReady(true);
          break;
        case 'complete':
          console.log('complete', e.data.embedding);
          setResult(e.data.embedding);
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener('message', onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () =>
      worker.current?.removeEventListener('message', onMessageReceived);
  }, []);

  const classify = useCallback((text: string) => {
    if (worker.current) {
      worker.current.postMessage({ text });
    }
  }, []);
  
  const resetResult = useCallback(() => {
    setResult([]);
  }, []);

  return { result, ready, classify, resetResult };
};

function EmbeddingDemo() {
  const [input, setInput] = useState('');
  const { result, ready, classify, resetResult } = useWorker('./worker.js');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="text-5xl font-bold mb-2 text-center">Transformers.js</h1>
      <h2 className="text-2xl mb-4 text-center">
        100% in-browser Semantic Search with{' '}
        <a
          className="underline"
          href="https://huggingface.co/docs/transformers.js"
        >
          Transformers.js
        </a>
        {', '}
        <a className="underline" href="https://github.com/electric-sql/pglite">
          PGlite
        </a>{' '}
        {' + '}
        <a className="underline" href="https://github.com/pgvector/pgvector">
          pgvector!
        </a>
      </h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          classify(input);
        }}
      >
        <input
          type="text"
          className="w-full max-w-xs p-2 border border-gray-300 rounded mb-4"
          placeholder="Enter text here"
          onInput={(e) => {
            resetResult();
            setInput(e.currentTarget.value);
          }}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 mb-4 rounded w-full max-w-xs"
        >
          Semantic Search
        </button>
      </form>

      {ready !== null && (
        <>
          <p className="text-center">Similarity Search results:</p>
          <pre className="bg-gray-100 p-2 rounded">
            {!ready || !result ? 'Loading...' : JSON.stringify(result)}
          </pre>
        </>
      )}
    </main>
  );
}


export default {
  title: 'Embedding/Local',
  component: EmbeddingDemo,
  parameters: {
    layout: 'fullscreen',
  },
};

export const Default = {
  args: {},
};

export const WithPrefilledQuery = {
  args: {
    initialInput: 'How do I create a database?',
  },
};

export const WithCustomThreshold = {
  args: {
    matchThreshold: 0.75,
    resultLimit: 5,
  },
};

// Story with combined parameters
export const FullExample = {
  args: {
    initialInput: 'Tell me about vector databases',
    matchThreshold: 0.7,
    resultLimit: 10,
  },
};
