type Option = { [index: string]: string };
type AcceptableProperty = (string | Element | Option);
type ConstructorArgs = (AcceptableProperty | null)[];
type RepeatConstructor = (AcceptableProperty | number | string[] | boolean | null)[];

type ElementPosition = 'after' | 'before';

type CheckboxOptions = {
    id: string,
    label: string
};

type CreateCheckboxReturnValue = [HTMLElement, HTMLElement] | [Manatsu, Manatsu];

// Global
type HTMLConstructorArgs = (string | Option | Manatsu)[];