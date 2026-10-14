import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listTags, deleteTag, type TagWithCount } from '../api';
import { TagCard } from '../components/TagCard';

export function TagsPage() {
  const [tags, setTags] = useState<TagWithCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    listTags()
      .then((loaded) => {
        if (active) {
          setTags(loaded);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Could not load the tags',
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function remove(id: string) {
    try {
      await deleteTag(id);
      setTags((current) =>
        current === null ? current : current.filter((tag) => tag.id !== id),
      );
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete the tag',
      );
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-5 sm:p-8">
      <h1 className="text-sm font-medium tracking-widest text-ink-faint uppercase">
        tags
      </h1>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      {tags === null ? (
        <p role="status" className="mt-4 text-sm text-ink-faint">
          loading tags…
        </p>
      ) : tags.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          No tags yet.{' '}
          <Link to="/" className="text-mark underline-offset-4 hover:underline">
            write a dump
          </Link>{' '}
          to create the first one.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {tags.map((tag) => (
            <TagCard key={tag.id} tag={tag} onDelete={remove} />
          ))}
        </ul>
      )}
    </section>
  );
}
