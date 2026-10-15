import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { listDumps, type Dump } from '../api';
import { DumpCard } from '../components/DumpCard';

function useTagDumps(tag: string) {
  const [dumps, setDumps] = useState<Dump[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    listDumps(tag)
      .then((loaded) => {
        if (active) {
          setDumps(loaded);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Could not load the dumps',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [tag]);

  return { dumps, error };
}

export function TagDumpsPage() {
  const { tag = '' } = useParams();
  const { dumps, error } = useTagDumps(tag);
  const countLabel =
    dumps === null
      ? null
      : dumps.length === 1
        ? '1 dump'
        : `${dumps.length} dumps`;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-5 sm:p-8">
      <header className="flex shrink-0 items-baseline gap-3">
        <h1 className="text-sm font-medium tracking-widest text-ink-faint uppercase">
          #{tag}
        </h1>
        {countLabel === null ? null : (
          <p className="text-xs text-ink-faint">{countLabel}</p>
        )}
      </header>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {error}
        </p>
      ) : dumps === null ? (
        <p role="status" className="mt-4 text-sm text-ink-faint">
          loading dumps…
        </p>
      ) : dumps.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          No dumps with #{tag} yet.{' '}
          <Link to="/" className="text-mark underline-offset-4 hover:underline">
            write a dump
          </Link>{' '}
          to add the first one.
        </p>
      ) : (
        <ul className="mt-6 grid list-none gap-3">
          {dumps.map((dump) => (
            <DumpCard key={dump.id} dump={dump} />
          ))}
        </ul>
      )}
    </section>
  );
}
