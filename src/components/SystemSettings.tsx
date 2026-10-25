"use client";

import { useEffect, useState } from "react";

const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base";

export default function SystemSettings({ initialFolder, initialCategories }: { initialFolder: string; initialCategories: string[] }) {
  const [folder, setFolder] = useState(initialFolder);
  const [categories, setCategories] = useState(initialCategories);
  const [categoryName, setCategoryName] = useState("");
  const [folderMessage, setFolderMessage] = useState("");
  const [folderError, setFolderError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    if (window.location.hash) {
      document.querySelector(window.location.hash)?.scrollIntoView();
    }
  }, []);

  async function saveFolder(event: React.FormEvent) {
    event.preventDefault();
    setSavingFolder(true);
    setFolderError("");
    setFolderMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      const payload = (await response.json()) as { folder?: string; moved?: number; error?: string };
      if (!response.ok || !payload.folder) {
        throw new Error(payload.error ?? "Could not update the folder location.");
      }
      setFolder(payload.folder);
      setFolderMessage(
        payload.moved
          ? `Folder updated. ${payload.moved} existing receipt file(s) were moved.`
          : "Folder updated. New receipts will be saved here."
      );
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Could not update the folder location.");
    } finally {
      setSavingFolder(false);
    }
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    setSavingCategory(true);
    setCategoryError("");
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName }),
      });
      const payload = (await response.json()) as { categories?: string[]; error?: string };
      if (!response.ok || !payload.categories) {
        throw new Error(payload.error ?? "Could not add the category.");
      }
      setCategories(payload.categories);
      setCategoryName("");
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "Could not add the category.");
    } finally {
      setSavingCategory(false);
    }
  }

  async function removeCategory(name: string) {
    setCategoryError("");
    const response = await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const payload = (await response.json()) as { categories?: string[]; error?: string };
    if (!response.ok || !payload.categories) {
      setCategoryError(payload.error ?? "Could not delete the category.");
      return;
    }
    setCategories(payload.categories);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">System Configuration</h1>

      <form id="folder-location" onSubmit={saveFolder} className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Folder Location</h2>
        <p className="mt-2 text-sm text-slate-600">
          Receipt photos are saved in this folder. On the server, use <span className="font-mono">/app/receipts</span>, which is the VPS folder <span className="font-mono">/root/receipts/Receipts</span>.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Folder
          <input value={folder} onChange={(event) => setFolder(event.target.value)} required className={fieldClass} />
        </label>
        {folderError && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{folderError}</p>}
        {folderMessage && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{folderMessage}</p>}
        <button type="submit" disabled={savingFolder} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400">
          {savingFolder ? "Saving..." : "Save folder"}
        </button>
      </form>

      <section id="category-dropdown" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Category Dropdown</h2>
        <p className="mt-2 text-sm text-slate-600">Category names kept for earlier receipts. New receipts ask for a description instead.</p>
        <form onSubmit={addCategory} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm font-medium text-slate-700">
            New category
            <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required maxLength={40} className={fieldClass} />
          </label>
          <button type="submit" disabled={savingCategory} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400">
            {savingCategory ? "Adding..." : "Add"}
          </button>
        </form>
        {categoryError && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{categoryError}</p>}
        {categories.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No categories yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {categories.map((name) => (
              <li key={name} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium text-slate-900">{name}</span>
                <button type="button" onClick={() => void removeCategory(name)} className="text-red-700 hover:underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
