/** Nav sections the customer named that don't have a real page built yet — see Layout.tsx's NAV_ITEMS. */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <p className="page-subtitle">{description}</p>
      <div className="card">
        <p className="hint-text">This section is coming soon.</p>
      </div>
    </div>
  );
}
