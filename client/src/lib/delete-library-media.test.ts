import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as React from 'react';
import { transformSync } from 'esbuild';
import { deleteLibraryMedia } from './delete-library-media';

const id = '10000000-0000-0000-0000-000000000001';
const good = {
  deleted_list_item_ids: [id], deleted_items: 1, deleted_posts: 2,
  deleted_ratings: 1, deleted_progress_events: 1,
};
const fakeClient = (result: any, calls: any[] = []) => ({
  rpc: async (...args: any[]) => { calls.push(args); return result; },
}) as unknown as Parameters<typeof deleteLibraryMedia>[0];

test('deletion sends only the owned item anchor, never a supplied user or canonical identity', async () => {
  const calls: any[] = [];
  assert.deepEqual(await deleteLibraryMedia(fakeClient({ data: good, error: null }, calls), id), good);
  assert.deepEqual(calls, [['delete_own_library_media', { p_item_id: id }]]);
});

test('missing migration, denied access, and network failures do not report success', async () => {
  await assert.rejects(deleteLibraryMedia(fakeClient({
    error: { code: 'PGRST202', message: 'missing function' },
  }), id), /not available yet.*Nothing was removed/);
  await assert.rejects(deleteLibraryMedia(fakeClient({
    error: { code: '42501', message: 'Not permitted' },
  }), id), /Not permitted/);
  const client = { rpc: async () => { throw new Error('offline'); } } as unknown as Parameters<typeof deleteLibraryMedia>[0];
  await assert.rejects(deleteLibraryMedia(client, id), /offline/);
});

test('bad anchors and unconfirmed or partial results are rejected', async () => {
  const calls: any[] = [];
  await assert.rejects(deleteLibraryMedia(fakeClient({ data: good }, calls), 'wrong-id'), /safely identified/);
  assert.equal(calls.length, 0);
  for (const data of [null, {}, { ...good, deleted_items: 0 }, { ...good, deleted_list_item_ids: [] }]) {
    await assert.rejects(deleteLibraryMedia(fakeClient({ data, error: null }), id), /could not be confirmed/);
  }
});

// Inspect the actual dialog's callbacks and disabled/error states without
// mounting authenticated pages or sending requests to production.
const dialogSource = readFileSync(new URL('../components/delete-library-media-dialog.tsx', import.meta.url), 'utf8')
  .replace(/import\s*\{[\s\S]*?\}\s*from\s*'@\/components\/ui\/[^']+';/g, '');
const uiNames = ['AlertDialog', 'AlertDialogContent', 'AlertDialogHeader', 'AlertDialogTitle',
  'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogCancel', 'Button'];
const dialogModule = { exports: {} as any };
vm.runInNewContext(transformSync(dialogSource, { loader: 'tsx', format: 'cjs', jsx: 'transform' }).code, {
  module: dialogModule, exports: dialogModule.exports, React,
  ...Object.fromEntries(uiNames.map(name => [name, name])),
});
const Dialog = dialogModule.exports.default;
function descendants(node: any): any[] {
  return React.isValidElement(node)
    ? [node, ...React.Children.toArray((node.props as any).children).flatMap(descendants)]
    : [];
}

test('confirmation is required; cancel and confirm are separate actions', () => {
  let cancelled = 0;
  let confirmed = 0;
  const tree = Dialog({ item: { id, title: 'Backrooms' }, pending: false, error: null,
    onCancel: () => { cancelled++; }, onConfirm: () => { confirmed++; } });
  assert.equal(confirmed, 0, 'Opening the dialog must not delete');
  tree.props.onOpenChange(false);
  assert.equal(cancelled, 1);
  assert.equal(confirmed, 0);
  descendants(tree).find(node => node.props['data-testid'] === 'confirm-delete-library-media').props.onClick();
  assert.equal(confirmed, 1);
});

test('pending deletion disables both buttons and prevents closing; failures stay visible', () => {
  let cancelled = 0;
  const tree = Dialog({ item: { id, title: 'Backrooms' }, pending: true, error: 'Could not delete',
    onCancel: () => { cancelled++; }, onConfirm: () => {} });
  tree.props.onOpenChange(false);
  assert.equal(cancelled, 0);
  const nodes = descendants(tree);
  assert.equal(nodes.find(node => node.type === 'Button').props.disabled, true);
  assert.equal(nodes.find(node => node.type === 'AlertDialogCancel').props.disabled, true);
  assert.equal(nodes.find(node => node.props.role === 'alert').props.children, 'Could not delete');
});
