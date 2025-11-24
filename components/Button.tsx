const FluentButton = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled }: any) => {
  // Fluent UI style buttons
  const baseStyle = "flex items-center justify-center gap-2 px-4 py-1.5 rounded-[4px] transition-all duration-200 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
  const variants = {
    primary: "bg-[#0078D4] hover:bg-[#106EBE] text-white shadow-sm", // Azure Blue
    secondary: "bg-white border border-[#8A8886] text-[#201F1E] hover:bg-[#F3F2F1]",
    ghost: "text-[#323130] hover:bg-[#F3F2F1]",
    icon: "p-2 text-[#605E5C] hover:bg-[#F3F2F1] rounded-full",
    danger: "bg-[#A80000] text-white hover:bg-[#C50F1F]"
  }
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}
    >
      {Icon && <Icon size={16} strokeWidth={2.5} />}
      {children}
    </button>
  )
}

export default FluentButton