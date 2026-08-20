import { useState, useMemo } from 'react';
import type { Note } from '../types'
import { api } from '../utils/api';
import { MarkdownView } from '../utils/markdown';
import { showToast } from '../utils/toastEvent';
import { ConfirmDialog } from './ConfirmDialog';
import { formatRelativeTime } from '../utils/relativeTime';
import { playClickSound } from '../utils/sound';

interface NoteListProps {
  taskId: string;
  notes: Note[];
  onUpdate: () => void;
}

export function NoteList({ taskId, notes, onUpdate }: NoteListProps) {
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [addShowPreview, setAddShowPreview] = useState(false);
  const [editShowPreview, setEditShowPreview] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const relativeTimeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of notes) {
      map.set(n.id, formatRelativeTime(n.updatedAt));
    }
    return map;
  }, [notes]);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    try {
      await api.tasks.addNote(taskId, newContent.trim());
      setNewContent('');
      setIsAdding(false);
      onUpdate();
      playClickSound();
    } catch {
      showToast('添加备注失败', 'error');
    }
  };

  const handleUpdate = async (noteId: string) => {
    if (!editContent.trim()) return;
    try {
      await api.tasks.updateNote(taskId, noteId, editContent.trim());
      setEditingNoteId(null);
      setEditContent('');
      onUpdate();
      playClickSound();
    } catch {
      showToast('更新备注失败', 'error');
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await api.tasks.deleteNote(taskId, noteId);
      setDeletingNoteId(null);
      onUpdate();
      playClickSound();
    } catch {
      showToast('删除备注失败', 'error');
    }
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditShowPreview(false);
  };

  const deletingNote = useMemo(
    () => (deletingNoteId ? notes.find((n) => n.id === deletingNoteId) : null),
    [deletingNoteId, notes]
  );

  return (
    <div role="group" aria-label="任务备注">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">备注</span>
          {notes.length > 0 && (
            <span className="text-xs text-text-muted" aria-label={`${notes.length}条备注`}>{notes.length}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          aria-label={isAdding ? '取消添加备注' : '添加备注'}
          aria-expanded={isAdding}
        >
          {isAdding ? '取消' : '+ 添加'}
        </button>
      </div>

      {/* Add input */}
      {isAdding && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="new-note-content" className="sr-only">备注内容</label>
            <button
              type="button"
              onClick={() => setAddShowPreview(!addShowPreview)}
              className="text-xs text-text-muted hover:text-text"
              aria-label={addShowPreview ? '切换到编辑模式' : '切换到预览模式'}
            >
              {addShowPreview ? '编辑' : '预览'}
            </button>
          </div>
          {addShowPreview ? (
            <div className="min-h-[76px] p-3 bg-surface-lighter rounded-lg">
              {newContent ? (
                <MarkdownView content={newContent} className="text-sm text-text" />
              ) : (
                <p className="text-sm text-text-muted">暂无内容</p>
              )}
            </div>
          ) : (
            <textarea
              id="new-note-content"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="input w-full resize-none text-sm"
              rows={3}
              placeholder="输入备注内容..."
              autoFocus
              aria-required="true"
            />
          )}
          {!addShowPreview && (
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-text-muted">
                支持: **粗体**, *斜体*, `代码`, - 列表
              </p>
              <span className="text-[10px] text-text-muted">
                {newContent.length} 字符
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewContent('');
                setAddShowPreview(false);
              }}
              className="btn btn-secondary text-sm px-3"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="btn btn-primary text-sm px-3"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* Note list */}
      <div className="space-y-2" role="list" aria-label="备注列表">
        {notes.map((note) => (
          <div
            key={note.id}
            className="group p-3 bg-surface-lighter rounded-lg"
            role="listitem"
            aria-label={`备注: ${note.content.slice(0, 30)}...`}
          >
            {editingNoteId === note.id ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor={`edit-note-${note.id}`} className="sr-only">编辑备注</label>
                  <button
                    type="button"
                    onClick={() => setEditShowPreview(!editShowPreview)}
                    className="text-xs text-text-muted hover:text-text"
                    aria-label={editShowPreview ? '切换到编辑模式' : '切换到预览模式'}
                  >
                    {editShowPreview ? '编辑' : '预览'}
                  </button>
                </div>
                {editShowPreview ? (
                  <div className="min-h-[76px] p-3 bg-surface-lighter rounded-lg">
                    <MarkdownView content={editContent} className="text-sm text-text" />
                  </div>
                ) : (
                  <>
                    <textarea
                      id={`edit-note-${note.id}`}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="input w-full resize-none text-sm"
                      rows={3}
                      autoFocus
                      aria-required="true"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-text-muted">
                        支持: **粗体**, *斜体*, `代码`, - 列表
                      </p>
                      <span className="text-[10px] text-text-muted">
                        {editContent.length} 字符
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteId(null);
                      setEditContent('');
                      setEditShowPreview(false);
                    }}
                    className="text-xs text-text-muted hover:text-text"
                    aria-label="取消编辑"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdate(note.id)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                    aria-label="保存备注"
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <>
                <MarkdownView
                  content={note.content}
                  className="text-sm text-text"
                />
                <div className="flex items-center justify-between mt-2">
                  <span
                    className="text-xs text-text-muted cursor-help"
                    title={note.updatedAt.replace('T', ' ').slice(0, 19)}
                  >
                    {relativeTimeMap.get(note.id)}
                  </span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => startEditing(note)}
                      className="text-xs text-text-muted hover:text-blue-600"
                      aria-label={`编辑备注: ${note.content.slice(0, 20)}...`}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingNoteId(note.id)}
                      className="text-xs text-text-muted hover:text-red-600"
                      aria-label={`删除备注: ${note.content.slice(0, 20)}...`}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {notes.length === 0 && !isAdding && (
        <p className="text-xs text-text-muted text-center py-2">暂无备注</p>
      )}

      {/* Delete Confirmation */}
      {deletingNote && (
        <ConfirmDialog
          title="删除备注"
          message={`确定要删除这条备注吗？此操作不可撤销。`}
          confirmText="删除"
          variant="danger"
          onConfirm={() => handleDelete(deletingNote.id)}
          onCancel={() => setDeletingNoteId(null)}
        />
      )}
    </div>
  );
}
