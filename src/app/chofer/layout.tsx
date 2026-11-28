export default function DriverLayout({ children }: LayoutProps<"/chofer">) {
  return (
    <>
      <header className="border-border bg-brand font-heading border-b px-4 py-3 text-lg font-bold text-white">
        Chofer
      </header>
      <div className="flex-1">{children}</div>
    </>
  );
}
