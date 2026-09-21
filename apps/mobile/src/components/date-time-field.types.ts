/** Shared contract for the two platform implementations of DateTimeField. */
export interface DateTimeFieldProps {
  label: string;
  /** null renders as an empty field rather than defaulting to "now". */
  value: Date | null;
  onChange: (date: Date | null) => void;
  error?: string | null;
  minimumDate?: Date;
  /** Shown on native while no date is chosen; the web input has its own. */
  placeholder?: string;
  testID?: string;
}
