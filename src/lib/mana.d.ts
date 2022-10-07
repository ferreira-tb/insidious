type Option = { [index: string]: string };
type AcceptableProperty = (string | Element | Option);
type ConstructorArgs = (AcceptableProperty | null)[];
type RepeatConstructor = (AcceptableProperty | number | string[] | null)[];

type CheckboxOptions = {
    id: string,
    label: string
};