import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Link, useParams } from 'react-router';
import {
  createDump,
  deleteDump,
  listDumps,
  updateDump,
  type Dump,
} from '../api';
import { Composer } from '../components/Composer';
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

  return { dumps, error, setDumps };
}

function carriesTag(dump: Dump, tag: string): boolean {
  return dump.tags.some((dumpTag) => dumpTag.name === tag);
}

function useDumpActions(
  tag: string,
  setDumps: Dispatch<SetStateAction<Dump[] | null>>,
) {
  const target = tag.toLowerCase();

  async function create(content: string) {
    const created = await createDump(content);

    if (carriesTag(created, target)) {
      setDumps((current) =>
        current === null ? current : [created, ...current],
      );
    }
  }

  async function update(id: string, content: string) {
    const updated = await updateDump(id, content);

    setDumps((current) => {
      if (current === null) {
        return current;
      }
      if (!carriesTag(updated, target)) {
        return current.filter((dump) => dump.id !== id);
      }

      return current.map((dump) => (dump.id === id ? updated : dump));
    });
  }

  async function remove(id: string) {
    await deleteDump(id);
    setDumps((current) =>
      current === null ? current : current.filter((dump) => dump.id !== id),
    );
  }

  return { create, update, remove };
}

export function TagDumpsPage() {
  const { tag = '' } = useParams();
  const { dumps, error, setDumps } = useTagDumps(tag);
  const { create, update, remove } = useDumpActions(tag, setDumps);
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

      <div className="mt-6 h-44 shrink-0">
        <Composer initialValue={`#${tag} `} onSubmit={create} />
      </div>

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
            <DumpCard
              key={dump.id}
              dump={dump}
              onUpdate={update}
              onDelete={remove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
