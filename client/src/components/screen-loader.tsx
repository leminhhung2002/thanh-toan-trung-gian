type ScreenLoaderProps = {
  message?: string
}

export function ScreenLoader({
  message = 'Đang tải...',
}: ScreenLoaderProps) {
  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      <div
        style={{
          color: '#555',
          fontSize: '14px',
          padding: '50px',
          textAlign: 'center',
        }}
      >
        {message}
      </div>
    </div>
  )
}
