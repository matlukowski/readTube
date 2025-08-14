export default function Loading({ size = 'md', fullScreen = false }: { size?: 'sm' | 'md' | 'lg', fullScreen?: boolean }) {
  const sizeClasses = {
    sm: 'loading-sm',
    md: 'loading-md',
    lg: 'loading-lg',
  };

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className={`loading loading-spinner ${sizeClasses[size]}`}></span>
      </div>
    );
  }

  return <span className={`loading loading-spinner ${sizeClasses[size]}`}></span>;
}