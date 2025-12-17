export enum Language {
  ENGLISH = 'English',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  GERMAN = 'German',
  JAPANESE = 'Japanese',
  MANDARIN = 'Mandarin Chinese',
  KOREAN = 'Korean',
  ITALIAN = 'Italian',
  PORTUGUESE = 'Portuguese'
}

export enum Proficiency {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced'
}

export enum PracticeMode {
  FREE_TALK = 'Free Talk',
  ROLE_PLAY = 'Role Play',
  GRAMMAR_FOCUS = 'Grammar Focus'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

export type AppStatus = 'setup' | 'active' | 'summary';

export interface AppState {
  language: Language;
  proficiency: Proficiency;
  mode: PracticeMode;
  status: AppStatus;
  summary?: string;
}

export enum VoiceName {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}