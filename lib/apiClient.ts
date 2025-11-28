import axios, { AxiosError, AxiosRequestConfig, CanceledError } from 'axios'

import type { AzureChatCredentials, ChatThreadMode, SerializableThread } from '@/lib/types/chat'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

const api = axios.create({
  baseURL: BASE_URL || undefined,
  headers: {
    'Content-Type': 'application/json'
  }
})

type ApiRequestConfig = AxiosRequestConfig & {
  errorMessage?: string
}

export async function apiRequest<TResponse = unknown>(config: ApiRequestConfig) {
  try {
    const response = await api.request<TResponse>(config)
    return response.data
  } catch (error) {
    if (error instanceof CanceledError) {
      throw error
    }
    if (axios.isAxiosError(error)) {
      const responseError = extractErrorMessage(error)
      const message = config.errorMessage ?? responseError ?? 'Request failed'
      throw new Error(message)
    }
    throw error
  }
}

function extractErrorMessage(error: AxiosError) {
  const payload = error.response?.data
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const value = (payload as { error?: string }).error
    if (typeof value === 'string') return value
  }
  if (typeof error.message === 'string' && error.message) {
    return error.message
  }
  return null
}

type ThreadsResponse = { threads: SerializableThread[] }

export function getUserThreads(userId: string, signal?: AbortSignal) {
  return apiRequest<ThreadsResponse>({
    url: `/api/users/${userId}/threads`,
    method: 'GET',
    signal,
    errorMessage: 'Unable to load threads'
  })
}

type ChatConfigResponse = { config: AzureChatCredentials }

export function getChatConfig(userId: string, threadId: string, signal?: AbortSignal) {
  return apiRequest<ChatConfigResponse>({
    url: '/api/chat/config',
    method: 'POST',
    data: { userId, threadId },
    signal,
    errorMessage: 'Unable to initialize chat adapter'
  })
}

export type CreateThreadParams =
  | {
      initiatorId: string
      mode: Extract<ChatThreadMode, 'ai'>
    }
  | {
      initiatorId: string
      peerId: string
      mode: Extract<ChatThreadMode, 'user'>
    }

type CreateThreadResponse = { thread: SerializableThread; config?: AzureChatCredentials }

export function createThread(params: CreateThreadParams) {
  return apiRequest<CreateThreadResponse>({
    url: '/api/threads',
    method: 'POST',
    data: params,
    errorMessage: 'Unable to start conversation'
  })
}

export type AiResponderPayload = {
  senderUserId: string
  messageText: string
  phoneNumber?: string
}

export function triggerAiResponder(payload: AiResponderPayload) {
  return apiRequest<void>({
    url: '/api/ai/messages',
    method: 'POST',
    data: payload,
    errorMessage: 'Failed to send AI response trigger'
  })
}

export type AiTypingIndicatorPayload = {
  receiverUserId: string
  threadId?: string
}

export function triggerAssistantTypingIndicator(payload: AiTypingIndicatorPayload) {
  return apiRequest<void>({
    url: '/api/ai/typing',
    method: 'POST',
    data: payload,
    errorMessage: 'Failed to notify assistant typing indicator'
  })
}
