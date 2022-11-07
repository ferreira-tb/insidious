type Option = { [index: string]: string };
type AcceptableProperty = (string | Element | Option);
type ConstructorArgs = (AcceptableProperty | null)[];
type RepeatConstructor = (AcceptableProperty | number | string[] | boolean | null)[];

type ElementHierarchy = 'child' | 'sibling';
type ElementPosition = 'after' | 'before';

type InputElement =
    | 'checkbox'
    | 'radio'
    | 'number'
    | 'text';

type InputOptions = {
    id: string,
    label: string,

    list?: string,
    max?: string,
    maxlength?: string,
    min?: string,
    minlength?: string,
    name?: string, 
    placeholder?: string,
    readonly?: string,
    size?: string,
    spellcheck?: string,
    step?: string
};

type InputReturnValue = [HTMLElement, HTMLElement] | [Manatsu, Manatsu];

// Global
type HTMLConstructorArgs = (string | Option | Manatsu)[];