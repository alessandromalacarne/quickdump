import { useCallback } from 'react';
import { createDump } from './api';
import { Composer } from './components/Composer';

function App() {
  const handleSubmit = useCallback(async (content: string) => {
    await createDump(content);
  }, []);

  return (
    <main className="flex h-dvh flex-col p-3 sm:p-5">
      <h1 className="sr-only">quickdump</h1>
      <Composer onSubmit={handleSubmit} />
    </main>
  );
}

export default App;
