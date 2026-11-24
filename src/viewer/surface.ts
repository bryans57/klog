export type ViewerCommand = 'search' | 'tail' | 'pods' | 'contexts' | 'use' | 'help' | 'version';

export function shouldUseViewer(input: {
    command: ViewerCommand;
    isTTY: boolean;
    outputExplicit: boolean;
    term?: string;
}): boolean {
    return (
        (input.command === 'search' || input.command === 'tail') &&
        input.isTTY &&
        !input.outputExplicit &&
        Boolean(input.term) &&
        input.term !== 'dumb'
    );
}
