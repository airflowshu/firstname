import type { ValidationError } from 'class-validator';
import { formatValidationErrors } from './validation-message.util';

describe('formatValidationErrors', () => {
  it('translates enum validation errors to Chinese', () => {
    const validationError: ValidationError = {
      property: 'category',
      constraints: {
        isEnum: 'category must be one of the following values: PHOTO, DOCUMENT',
      },
    };

    const messages = formatValidationErrors([validationError]);

    expect(messages).toEqual(['资料类型的取值不合法。']);
  });
});
