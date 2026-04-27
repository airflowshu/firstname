declare module 'relationship.js' {
  interface RelationshipOptions {
    text?: string;
    target?: string;
    sex?: -1 | 0 | 1;
    type?: 'default' | 'chain' | 'pair';
    reverse?: boolean;
    mode?: string;
    optimal?: boolean;
  }

  interface RelationshipFn {
    (options: RelationshipOptions | string): string[];
    data: Record<string, string[]>;
    dataCount: number;
    setMode: (modeName: string, modeData: Record<string, string[]>) => void;
  }

  const relationship: RelationshipFn;
  export default relationship;
}
