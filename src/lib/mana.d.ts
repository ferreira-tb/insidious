type Option = { [index: string]: string };
type AcceptableProperty = (string | Element | Option);
type ConstructorArgs = (AcceptableProperty | null)[];
type RepeatConstructor = (AcceptableProperty | number | string[] | boolean | null)[];

type ElementHierarchy = 'child' | 'sibling';
type ElementPosition = 'after' | 'before';

type InputElements = 'checkbox' | 'radio';

type RadioAndBoxOptions = {
    id: string,
    label: string,
    name?: string
};

type RadioAndBoxReturnValue = [HTMLElement, HTMLElement] | [Manatsu, Manatsu];

// Global
type HTMLConstructorArgs = (string | Option | Manatsu)[];