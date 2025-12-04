"use client"

import { type FC, memo } from 'react'
import ReactMarkdown, { type Options } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { renderToStaticMarkup } from 'react-dom/server'

type ChatMarkdownProps = {
  content: string
}

type MarkdownRendererProps = {
  content: string
}

const MarkdownBase: FC<Options> = memo(ReactMarkdown, (prev, next) => prev.children === next.children)

const MarkdownRenderer: FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <MarkdownBase
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw]}
      components={{
        p({ children }) {
          return <p className="mb-3 text-sm leading-6 text-inherit last:mb-0">{children}</p>
        },
        h1({ children, ...props }) {
          return (
            <h1 className="pt-2 text-lg font-semibold leading-7 text-inherit" {...props}>
              {children}
            </h1>
          )
        },
        h2({ children, ...props }) {
          return (
            <h2 className="text-base md:text-lg font-semibold leading-6 text-inherit" {...props}>
              {children}
            </h2>
          )
        },
        h3({ children, ...props }) {
          return (
            <h3 className="text-sm font-semibold leading-6 text-inherit" {...props}>
              {children}
            </h3>
          )
        },
        ul({ children, ...props }) {
          return (
            <ul className="my-2 ml-4 list-disc space-y-2 text-sm leading-6 text-inherit" {...props}>
              {children}
            </ul>
          )
        },
        ol({ children, ...props }) {
          return (
            <ol className="ml-4 list-decimal space-y-2 text-sm leading-6 text-inherit" {...props}>
              {children}
            </ol>
          )
        },
        li({ children, ...props }) {
          return (
            <li className="my-1" {...props}>
              {children}
            </li>
          )
        },
        hr() {
          return <hr className="my-2 border-slate-200/40" />
        },
        a({ children, ...props }) {
          return (
            <a className="font-semibold text-current underline underline-offset-4" target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          )
        },
        code() {
          return null
        }
      }}
    >
      {content}
    </MarkdownBase>
  )
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  if (!content) {
    return null
  }

  return (
    <div className="mesh-chat-markdown">
      <MarkdownRenderer content={content} />
    </div>
  )
}

export function renderMarkdownToHtml(content: string) {
  if (!content.trim()) {
    return ''
  }
  return renderToStaticMarkup(
    <div className="mesh-chat-markdown">
      <MarkdownRenderer content={content} />
    </div>
  )
}
