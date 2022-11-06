declare global {
    interface HTMLElement {
        appendManatsu: (...args: HTMLConstructorArgs) => HTMLElement
    }
}

export {};