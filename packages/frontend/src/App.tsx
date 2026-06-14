import { Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}

function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          TaskFlow
        </h1>
        <p className="text-lg text-muted-foreground">
          Team task management, simplified.
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <a
            href="#"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90"
          >
            Get Started
          </a>
          <a
            href="#"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-accent"
          >
            Learn More
          </a>
        </div>
      </div>
    </div>
  );
}
