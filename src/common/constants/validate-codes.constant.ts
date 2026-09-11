/**
 * Validation Error Codes - Tất cả mã lỗi validation theo module
 * Tiền tố: AUTH_ (auth module), USER_ (user module)
 *
 * Sử dụng trong DTO context: { errorCode: VALIDATE_CODES.AUTH_USERNAME_EMPTY, field: 'username' }
 */

export const VALIDATE_CODES = {
  // ====================== AUTH MODULE ======================

  // --- Username ---
  AUTH_USERNAME_EMPTY: 'AUTH_USERNAME_EMPTY',
  AUTH_USERNAME_INVALID: 'AUTH_USERNAME_INVALID',
  AUTH_USERNAME_MIN: 'AUTH_USERNAME_MIN',
  AUTH_USERNAME_MAX: 'AUTH_USERNAME_MAX',

  // --- Password ---
  AUTH_PASSWORD_EMPTY: 'AUTH_PASSWORD_EMPTY',
  AUTH_PASSWORD_INVALID: 'AUTH_PASSWORD_INVALID',
  AUTH_PASSWORD_MIN: 'AUTH_PASSWORD_MIN',
  AUTH_PASSWORD_MAX: 'AUTH_PASSWORD_MAX',
  AUTH_PASSWORD_STRONG: 'AUTH_PASSWORD_STRONG',

  // --- Email ---
  AUTH_EMAIL_EMPTY: 'AUTH_EMAIL_EMPTY',
  AUTH_EMAIL_INVALID: 'AUTH_EMAIL_INVALID',
  AUTH_EMAIL_MAX: 'AUTH_EMAIL_MAX',

  // --- OTP ---
  AUTH_OTP_EMPTY: 'AUTH_OTP_EMPTY',
  AUTH_OTP_INVALID: 'AUTH_OTP_INVALID',
  AUTH_OTP_EXACT_LENGTH: 'AUTH_OTP_EXACT_LENGTH',
  AUTH_OTP_NUMERIC: 'AUTH_OTP_NUMERIC',

  // --- Refresh Token ---
  AUTH_REFRESH_TOKEN_EMPTY: 'AUTH_REFRESH_TOKEN_EMPTY',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',

  // --- Type Verify ---
  AUTH_TYPE_VERIFY_EMPTY: 'AUTH_TYPE_VERIFY_EMPTY',
  AUTH_TYPE_VERIFY_INVALID: 'AUTH_TYPE_VERIFY_INVALID',

  // ====================== USER MODULE ======================

  // --- Username ---
  USER_USERNAME_INVALID: 'USER_USERNAME_INVALID',
  USER_USERNAME_MIN: 'USER_USERNAME_MIN',
  USER_USERNAME_MAX: 'USER_USERNAME_MAX',

  // --- Password ---
  USER_PASSWORD_INVALID: 'USER_PASSWORD_INVALID',
  USER_PASSWORD_MIN: 'USER_PASSWORD_MIN',
  USER_PASSWORD_MAX: 'USER_PASSWORD_MAX',
  USER_PASSWORD_STRONG: 'USER_PASSWORD_STRONG',

  // --- Email ---
  USER_EMAIL_INVALID: 'USER_EMAIL_INVALID',
  USER_EMAIL_MAX: 'USER_EMAIL_MAX',

  // --- OTP ---
  USER_OTP_INVALID: 'USER_OTP_INVALID',
  USER_OTP_EXACT_LENGTH: 'USER_OTP_EXACT_LENGTH',
  USER_OTP_NUMERIC: 'USER_OTP_NUMERIC',

  // --- Phone ---
  USER_PHONE_INVALID: 'USER_PHONE_INVALID',

  // ====================== WORKSPACE MODULE ======================

  // --- ID ---
  WORKSPACE_ID_STRING: 'WORKSPACE_ID_STRING',

  // --- Name ---
  WORKSPACE_NAME_EMPTY: 'WORKSPACE_NAME_EMPTY',
  WORKSPACE_NAME_INVALID: 'WORKSPACE_NAME_INVALID',
  WORKSPACE_NAME_MIN: 'WORKSPACE_NAME_MIN',
  WORKSPACE_NAME_MAX: 'WORKSPACE_NAME_MAX',

  // --- Description ---
  WORKSPACE_DESCRIPTION_INVALID: 'WORKSPACE_DESCRIPTION_INVALID',

  // ====================== PROJECT MODULE ======================

  // --- Name ---
  PROJECT_NAME_EMPTY: 'PROJECT_NAME_EMPTY',
  PROJECT_NAME_INVALID: 'PROJECT_NAME_INVALID',
  PROJECT_NAME_MIN: 'PROJECT_NAME_MIN',
  PROJECT_NAME_MAX: 'PROJECT_NAME_MAX',

  // --- Description ---
  PROJECT_DESCRIPTION_INVALID: 'PROJECT_DESCRIPTION_INVALID',

  // --- Directory ---
  PROJECT_DIRECTORY_EMPTY: 'PROJECT_DIRECTORY_EMPTY',
  PROJECT_DIRECTORY_INVALID: 'PROJECT_DIRECTORY_INVALID',

  // ====================== SESSION MODULE ======================

  // --- Title ---
  SESSION_TITLE_EMPTY: 'SESSION_TITLE_EMPTY',
  SESSION_TITLE_INVALID: 'SESSION_TITLE_INVALID',
  SESSION_TITLE_MIN: 'SESSION_TITLE_MIN',
  SESSION_TITLE_MAX: 'SESSION_TITLE_MAX',

  // --- Model ---
  SESSION_MODEL_INVALID: 'SESSION_MODEL_INVALID',

  // ====================== TOOL CONFIG MODULE ======================

  // --- Tool ID ---
  TOOL_CONFIG_TOOL_ID_EMPTY: 'TOOL_CONFIG_TOOL_ID_EMPTY',
  TOOL_CONFIG_TOOL_ID_INVALID: 'TOOL_CONFIG_TOOL_ID_INVALID',

  // --- Is Enabled ---
  TOOL_CONFIG_IS_ENABLED_INVALID: 'TOOL_CONFIG_IS_ENABLED_INVALID',

  // ====================== MCP SERVER CONFIG MODULE ======================

  // --- Name ---
  MCP_SERVER_NAME_EMPTY: 'MCP_SERVER_NAME_EMPTY',
  MCP_SERVER_NAME_INVALID: 'MCP_SERVER_NAME_INVALID',

  // --- Transport ---
  MCP_SERVER_TRANSPORT_INVALID: 'MCP_SERVER_TRANSPORT_INVALID',

  // --- Command ---
  MCP_SERVER_COMMAND_INVALID: 'MCP_SERVER_COMMAND_INVALID',

  // --- Args ---
  MCP_SERVER_ARGS_INVALID: 'MCP_SERVER_ARGS_INVALID',

  // --- Env ---
  MCP_SERVER_ENV_INVALID: 'MCP_SERVER_ENV_INVALID',

  // --- URL ---
  MCP_SERVER_URL_INVALID: 'MCP_SERVER_URL_INVALID',

  // --- Headers ---
  MCP_SERVER_HEADERS_INVALID: 'MCP_SERVER_HEADERS_INVALID',

  // --- Timeout ---
  MCP_SERVER_TIMEOUT_INVALID: 'MCP_SERVER_TIMEOUT_INVALID',

  // --- Is Active ---
  MCP_SERVER_IS_ACTIVE_INVALID: 'MCP_SERVER_IS_ACTIVE_INVALID',

  // ====================== CUSTOM TOOL CONFIG MODULE ======================

  // --- Name ---
  CUSTOM_TOOL_NAME_EMPTY: 'CUSTOM_TOOL_NAME_EMPTY',
  CUSTOM_TOOL_NAME_INVALID: 'CUSTOM_TOOL_NAME_INVALID',

  // --- Description ---
  CUSTOM_TOOL_DESCRIPTION_EMPTY: 'CUSTOM_TOOL_DESCRIPTION_EMPTY',
  CUSTOM_TOOL_DESCRIPTION_INVALID: 'CUSTOM_TOOL_DESCRIPTION_INVALID',

  // --- Input Schema ---
  CUSTOM_TOOL_SCHEMA_INVALID: 'CUSTOM_TOOL_SCHEMA_INVALID',

  // --- Handler Type ---
  CUSTOM_TOOL_HANDLER_TYPE_INVALID: 'CUSTOM_TOOL_HANDLER_TYPE_INVALID',

  // --- Handler Config ---
  CUSTOM_TOOL_HANDLER_CONFIG_INVALID: 'CUSTOM_TOOL_HANDLER_CONFIG_INVALID',

  // --- Is Active ---
  CUSTOM_TOOL_IS_ACTIVE_INVALID: 'CUSTOM_TOOL_IS_ACTIVE_INVALID',

  // --- Timeout ---
  CUSTOM_TOOL_TIMEOUT_INVALID: 'CUSTOM_TOOL_TIMEOUT_INVALID',

  // ====================== KNOWLEDGE MODULE ======================

  // --- Key ---
  KNOWLEDGE_KEY_EMPTY: 'KNOWLEDGE_KEY_EMPTY',
  KNOWLEDGE_KEY_INVALID: 'KNOWLEDGE_KEY_INVALID',

  // --- Value ---
  KNOWLEDGE_VALUE_EMPTY: 'KNOWLEDGE_VALUE_EMPTY',
  KNOWLEDGE_VALUE_INVALID: 'KNOWLEDGE_VALUE_INVALID',

  // --- Tier ---
  KNOWLEDGE_TIER_INVALID: 'KNOWLEDGE_TIER_INVALID',

  // --- Tags ---
  KNOWLEDGE_TAGS_INVALID: 'KNOWLEDGE_TAGS_INVALID',

  // ====================== PLUGIN CONFIG MODULE ======================

  // --- Plugin ID ---
  PLUGIN_CONFIG_PLUGIN_ID_EMPTY: 'PLUGIN_CONFIG_PLUGIN_ID_EMPTY',
  PLUGIN_CONFIG_PLUGIN_ID_INVALID: 'PLUGIN_CONFIG_PLUGIN_ID_INVALID',

  // --- Version ---
  PLUGIN_CONFIG_VERSION_EMPTY: 'PLUGIN_CONFIG_VERSION_EMPTY',
  PLUGIN_CONFIG_VERSION_INVALID: 'PLUGIN_CONFIG_VERSION_INVALID',

  // --- Is Enabled ---
  PLUGIN_CONFIG_IS_ENABLED_INVALID: 'PLUGIN_CONFIG_IS_ENABLED_INVALID',

  // ====================== AGENT MODULE ======================

  // --- Session ID ---
  AGENT_SESSION_ID_STRING: 'AGENT_SESSION_ID_STRING',
  AGENT_SESSION_ID_EMPTY: 'AGENT_SESSION_ID_EMPTY',

  // --- Prompt ---
  AGENT_PROMPT_STRING: 'AGENT_PROMPT_STRING',
  AGENT_PROMPT_EMPTY: 'AGENT_PROMPT_EMPTY',
  AGENT_PROMPT_MIN: 'AGENT_PROMPT_MIN',
  AGENT_PROMPT_MAX: 'AGENT_PROMPT_MAX',
  AGENT_PROMPT_VALIDATE: 'AGENT_PROMPT_VALIDATE',

  // --- Model ---
  AGENT_MODEL_STRING: 'AGENT_MODEL_STRING',

  // --- Provider ---
  AGENT_PROVIDER_STRING: 'AGENT_PROVIDER_STRING',
} as const;

export type ValidateCodeType =
  (typeof VALIDATE_CODES)[keyof typeof VALIDATE_CODES];

/**
 * Validation Messages - Mô tả lỗi tiếng Việt cho từng mã
 * Dùng để reference khi cần debug hoặc tài liệu
 */
export const VALIDATE_MESSAGES: Record<ValidateCodeType, string> = {
  // AUTH - Username
  [VALIDATE_CODES.AUTH_USERNAME_EMPTY]: 'Tên người dùng không được để trống',
  [VALIDATE_CODES.AUTH_USERNAME_INVALID]: 'Tên người dùng phải là chuỗi hợp lệ',
  [VALIDATE_CODES.AUTH_USERNAME_MIN]: 'Tên người dùng phải có ít nhất 2 ký tự',
  [VALIDATE_CODES.AUTH_USERNAME_MAX]: 'Tên người dùng không được quá 255 ký tự',

  // AUTH - Password
  [VALIDATE_CODES.AUTH_PASSWORD_EMPTY]: 'Mật khẩu không được để trống',
  [VALIDATE_CODES.AUTH_PASSWORD_INVALID]: 'Mật khẩu phải là chuỗi hợp lệ',
  [VALIDATE_CODES.AUTH_PASSWORD_MIN]: 'Mật khẩu phải có ít nhất 8 ký tự',
  [VALIDATE_CODES.AUTH_PASSWORD_MAX]: 'Mật khẩu không được quá 50 ký tự',
  [VALIDATE_CODES.AUTH_PASSWORD_STRONG]:
    'Mật khẩu phải chứa chữ hoa, chữ thường, số và ký tự đặc biệt',

  // AUTH - Email
  [VALIDATE_CODES.AUTH_EMAIL_EMPTY]: 'Email không được để trống',
  [VALIDATE_CODES.AUTH_EMAIL_INVALID]: 'Email không đúng định dạng',
  [VALIDATE_CODES.AUTH_EMAIL_MAX]: 'Email không được quá 100 ký tự',

  // AUTH - OTP
  [VALIDATE_CODES.AUTH_OTP_EMPTY]: 'Mã OTP không được để trống',
  [VALIDATE_CODES.AUTH_OTP_INVALID]: 'Mã OTP phải là chuỗi hợp lệ',
  [VALIDATE_CODES.AUTH_OTP_EXACT_LENGTH]: 'Mã OTP phải có đúng 6 chữ số',
  [VALIDATE_CODES.AUTH_OTP_NUMERIC]: 'Mã OTP chỉ được chứa chữ số',

  // AUTH - Refresh Token
  [VALIDATE_CODES.AUTH_REFRESH_TOKEN_EMPTY]:
    'Refresh token không được để trống',
  [VALIDATE_CODES.AUTH_REFRESH_TOKEN_INVALID]: 'Refresh token không hợp lệ',

  // AUTH - Type Verify
  [VALIDATE_CODES.AUTH_TYPE_VERIFY_EMPTY]: 'Loại xác minh không được để trống',
  [VALIDATE_CODES.AUTH_TYPE_VERIFY_INVALID]: 'Loại xác minh không hợp lệ',

  // USER - Username
  [VALIDATE_CODES.USER_USERNAME_INVALID]: 'Tên người dùng phải là chuỗi hợp lệ',
  [VALIDATE_CODES.USER_USERNAME_MIN]: 'Tên người dùng phải có ít nhất 2 ký tự',
  [VALIDATE_CODES.USER_USERNAME_MAX]: 'Tên người dùng không được quá 255 ký tự',

  // USER - Password
  [VALIDATE_CODES.USER_PASSWORD_INVALID]: 'Mật khẩu phải là chuỗi hợp lệ',
  [VALIDATE_CODES.USER_PASSWORD_MIN]: 'Mật khẩu phải có ít nhất 8 ký tự',
  [VALIDATE_CODES.USER_PASSWORD_MAX]: 'Mật khẩu không được quá 50 ký tự',
  [VALIDATE_CODES.USER_PASSWORD_STRONG]:
    'Mật khẩu phải chứa chữ hoa, chữ thường, số và ký tự đặc biệt',

  // USER - Email
  [VALIDATE_CODES.USER_EMAIL_INVALID]: 'Email không đúng định dạng',
  [VALIDATE_CODES.USER_EMAIL_MAX]: 'Email không được quá 100 ký tự',

  // USER - OTP
  [VALIDATE_CODES.USER_OTP_INVALID]: 'Mã OTP phải là chuỗi hợp lệ',
  [VALIDATE_CODES.USER_OTP_EXACT_LENGTH]: 'Mã OTP phải có đúng 6 chữ số',
  [VALIDATE_CODES.USER_OTP_NUMERIC]: 'Mã OTP chỉ được chứa chữ số',

  // USER - Phone
  [VALIDATE_CODES.USER_PHONE_INVALID]: 'Số điện thoại không hợp lệ',

  // WORKSPACE - Name
  [VALIDATE_CODES.WORKSPACE_ID_STRING]: 'Workspace ID phải là chuỗi hợp lệ',
  [VALIDATE_CODES.WORKSPACE_NAME_EMPTY]: 'Tên workspace không được để trống',
  [VALIDATE_CODES.WORKSPACE_NAME_INVALID]: 'Tên workspace phải là chuỗi hợp lệ',
  [VALIDATE_CODES.WORKSPACE_NAME_MIN]: 'Tên workspace phải có ít nhất 3 ký tự',
  [VALIDATE_CODES.WORKSPACE_NAME_MAX]: 'Tên workspace không được quá 255 ký tự',

  // WORKSPACE - Description
  [VALIDATE_CODES.WORKSPACE_DESCRIPTION_INVALID]:
    'Mô tả workspace phải là chuỗi hợp lệ',

  // PROJECT - Name
  [VALIDATE_CODES.PROJECT_NAME_EMPTY]: 'Tên project không được để trống',
  [VALIDATE_CODES.PROJECT_NAME_INVALID]: 'Tên project phải là chuỗi hợp lệ',
  [VALIDATE_CODES.PROJECT_NAME_MIN]: 'Tên project phải có ít nhất 3 ký tự',
  [VALIDATE_CODES.PROJECT_NAME_MAX]: 'Tên project không được quá 255 ký tự',

  // PROJECT - Description
  [VALIDATE_CODES.PROJECT_DESCRIPTION_INVALID]:
    'Mô tả project phải là chuỗi hợp lệ',

  // PROJECT - Directory
  [VALIDATE_CODES.PROJECT_DIRECTORY_EMPTY]:
    'Thư mục làm việc không được để trống',
  [VALIDATE_CODES.PROJECT_DIRECTORY_INVALID]:
    'Thư mục làm việc phải là chuỗi hợp lệ',

  // SESSION - Title
  [VALIDATE_CODES.SESSION_TITLE_EMPTY]: 'Tiêu đề session không được để trống',
  [VALIDATE_CODES.SESSION_TITLE_INVALID]:
    'Tiêu đề session phải là chuỗi hợp lệ',
  [VALIDATE_CODES.SESSION_TITLE_MIN]: 'Tiêu đề session phải có ít nhất 3 ký tự',
  [VALIDATE_CODES.SESSION_TITLE_MAX]:
    'Tiêu đề session không được quá 255 ký tự',

  // SESSION - Model
  [VALIDATE_CODES.SESSION_MODEL_INVALID]: 'Model phải là chuỗi hợp lệ',

  // TOOL CONFIG - Tool ID
  [VALIDATE_CODES.TOOL_CONFIG_TOOL_ID_EMPTY]: 'Tool ID không được để trống',
  [VALIDATE_CODES.TOOL_CONFIG_TOOL_ID_INVALID]: 'Tool ID phải là chuỗi hợp lệ',

  // TOOL CONFIG - Is Enabled
  [VALIDATE_CODES.TOOL_CONFIG_IS_ENABLED_INVALID]:
    'Trạng thái kích hoạt phải là boolean',

  // MCP SERVER CONFIG - Name
  [VALIDATE_CODES.MCP_SERVER_NAME_EMPTY]: 'Tên MCP server không được để trống',
  [VALIDATE_CODES.MCP_SERVER_NAME_INVALID]:
    'Tên MCP server phải là chuỗi hợp lệ',

  // MCP SERVER CONFIG - Transport
  [VALIDATE_CODES.MCP_SERVER_TRANSPORT_INVALID]:
    'Transport phải là stdio, sse hoặc streamable-http',

  // MCP SERVER CONFIG - Command
  [VALIDATE_CODES.MCP_SERVER_COMMAND_INVALID]: 'Command phải là chuỗi hợp lệ',

  // MCP SERVER CONFIG - Args
  [VALIDATE_CODES.MCP_SERVER_ARGS_INVALID]: 'Args phải là mảng',

  // MCP SERVER CONFIG - Env
  [VALIDATE_CODES.MCP_SERVER_ENV_INVALID]: 'Env phải là object',

  // MCP SERVER CONFIG - URL
  [VALIDATE_CODES.MCP_SERVER_URL_INVALID]: 'URL phải là chuỗi hợp lệ',

  // MCP SERVER CONFIG - Headers
  [VALIDATE_CODES.MCP_SERVER_HEADERS_INVALID]: 'Headers phải là object',

  // MCP SERVER CONFIG - Timeout
  [VALIDATE_CODES.MCP_SERVER_TIMEOUT_INVALID]: 'Timeout phải là số',

  // MCP SERVER CONFIG - Is Active
  [VALIDATE_CODES.MCP_SERVER_IS_ACTIVE_INVALID]:
    'Trạng thái kích hoạt phải là boolean',

  // CUSTOM TOOL CONFIG - Name
  [VALIDATE_CODES.CUSTOM_TOOL_NAME_EMPTY]:
    'Tên custom tool không được để trống',
  [VALIDATE_CODES.CUSTOM_TOOL_NAME_INVALID]:
    'Tên custom tool phải là chuỗi hợp lệ',

  // CUSTOM TOOL CONFIG - Description
  [VALIDATE_CODES.CUSTOM_TOOL_DESCRIPTION_EMPTY]:
    'Mô tả custom tool không được để trống',
  [VALIDATE_CODES.CUSTOM_TOOL_DESCRIPTION_INVALID]:
    'Mô tả custom tool phải là chuỗi hợp lệ',

  // CUSTOM TOOL CONFIG - Input Schema
  [VALIDATE_CODES.CUSTOM_TOOL_SCHEMA_INVALID]: 'Input schema phải là object',

  // CUSTOM TOOL CONFIG - Handler Type
  [VALIDATE_CODES.CUSTOM_TOOL_HANDLER_TYPE_INVALID]:
    'Handler type phải là webhook hoặc mock',

  // CUSTOM TOOL CONFIG - Handler Config
  [VALIDATE_CODES.CUSTOM_TOOL_HANDLER_CONFIG_INVALID]:
    'Handler config phải là object',

  // CUSTOM TOOL CONFIG - Is Active
  [VALIDATE_CODES.CUSTOM_TOOL_IS_ACTIVE_INVALID]:
    'Trạng thái kích hoạt phải là boolean',

  // CUSTOM TOOL CONFIG - Timeout
  [VALIDATE_CODES.CUSTOM_TOOL_TIMEOUT_INVALID]: 'Timeout phải là số',

  // KNOWLEDGE - Key
  [VALIDATE_CODES.KNOWLEDGE_KEY_EMPTY]: 'Key không được để trống',
  [VALIDATE_CODES.KNOWLEDGE_KEY_INVALID]: 'Key phải là chuỗi hợp lệ',

  // KNOWLEDGE - Value
  [VALIDATE_CODES.KNOWLEDGE_VALUE_EMPTY]: 'Giá trị không được để trống',
  [VALIDATE_CODES.KNOWLEDGE_VALUE_INVALID]: 'Giá trị phải là chuỗi hợp lệ',

  // KNOWLEDGE - Tier
  [VALIDATE_CODES.KNOWLEDGE_TIER_INVALID]: 'Tier không hợp lệ',

  // KNOWLEDGE - Tags
  [VALIDATE_CODES.KNOWLEDGE_TAGS_INVALID]: 'Tags phải là mảng chuỗi',

  // PLUGIN CONFIG - Plugin ID
  [VALIDATE_CODES.PLUGIN_CONFIG_PLUGIN_ID_EMPTY]:
    'Plugin ID không được để trống',
  [VALIDATE_CODES.PLUGIN_CONFIG_PLUGIN_ID_INVALID]:
    'Plugin ID phải là chuỗi hợp lệ',

  // PLUGIN CONFIG - Version
  [VALIDATE_CODES.PLUGIN_CONFIG_VERSION_EMPTY]: 'Phiên bản không được để trống',
  [VALIDATE_CODES.PLUGIN_CONFIG_VERSION_INVALID]:
    'Phiên bản phải là chuỗi hợp lệ',

  // PLUGIN CONFIG - Is Enabled
  [VALIDATE_CODES.PLUGIN_CONFIG_IS_ENABLED_INVALID]:
    'Trạng thái kích hoạt phải là boolean',

  // AGENT - Session ID
  [VALIDATE_CODES.AGENT_SESSION_ID_STRING]: 'Session ID phải là chuỗi hợp lệ',
  [VALIDATE_CODES.AGENT_SESSION_ID_EMPTY]: 'Session ID không được để trống',

  // AGENT - Prompt
  [VALIDATE_CODES.AGENT_PROMPT_STRING]: 'Prompt phải là chuỗi hợp lệ',
  [VALIDATE_CODES.AGENT_PROMPT_EMPTY]: 'Prompt không được để trống',
  [VALIDATE_CODES.AGENT_PROMPT_MIN]: 'Prompt phải có ít nhất 1 ký tự',
  [VALIDATE_CODES.AGENT_PROMPT_MAX]: 'Prompt không được quá 100000 ký tự',
  [VALIDATE_CODES.AGENT_PROMPT_VALIDATE]: 'Prompt không hợp lệ',

  // AGENT - Model
  [VALIDATE_CODES.AGENT_MODEL_STRING]: 'Model phải là chuỗi hợp lệ',

  // AGENT - Provider
  [VALIDATE_CODES.AGENT_PROVIDER_STRING]: 'Provider phải là chuỗi hợp lệ',
};
