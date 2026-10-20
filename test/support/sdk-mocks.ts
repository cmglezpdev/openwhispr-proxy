import {
  generateText as sdkGenerateText,
  transcribe as sdkTranscribe,
} from 'ai';
import { createGateway as sdkCreateGateway } from '@ai-sdk/gateway';
import { createOpenAICompatible as sdkCreateOpenAICompatible } from '@ai-sdk/openai-compatible';
import type {
  SdkChatCall,
  SdkChatResult,
  SdkTranscriptionCall,
  SdkTranscriptionResult,
  SdkProviderOptions,
  SdkGatewayClient,
  SdkChatClient,
} from './sdk-types';

// Jest replaces ESM SDK functions in jest-setup.ts. These test-only contracts
// describe the fixture fields used by the adapter, not the SDK's full API.
export const generateText = sdkGenerateText as unknown as jest.Mock<
  Promise<SdkChatResult>,
  [SdkChatCall]
>;
export const transcribe = sdkTranscribe as unknown as jest.Mock<
  Promise<SdkTranscriptionResult>,
  [SdkTranscriptionCall]
>;
export const createGateway = sdkCreateGateway as unknown as jest.Mock<
  SdkGatewayClient,
  [SdkProviderOptions]
>;
export const createOpenAICompatible =
  sdkCreateOpenAICompatible as unknown as jest.Mock<
    SdkChatClient,
    [SdkProviderOptions]
  >;
