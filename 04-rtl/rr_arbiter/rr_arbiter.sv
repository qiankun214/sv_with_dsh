// -----------------------------------------------------------------------------
// rr_arbiter —— 轮询仲裁器
//
// 对应详设：DES-rra-001（03-design/rr_arbiter/DES-rra-001-arbitration-policy.md）
// 时钟域：单时钟域 clk
// 复位：同步复位、低有效 rst_n；只复位轮询指针 ptr_q，输出不被复位门控（DES F8）
// 编码规范：standards/coding-standard.md（该文件当前为 PLACEHOLDER，本产物依赖该占位规范）
// 风格约定（评审逐条核对）：一个 always 块 / assign 只给一个变量赋值，只有强关联的
//   信号才合块（如 idx_hi/idx_lo 与扫描标志）；不使用嵌套三目（见 DES「实现规划」）。
//
// 功能：NUM_REQ 个请求者按轮询指针给出 one-hot 授权，授权组合透传；
//       当前拍存在有效授权时指针推进到被授权者的下一个索引，无请求时保持。
// -----------------------------------------------------------------------------

module rr_arbiter #(
    parameter int unsigned NUM_REQ = 4
) (
    input  logic               clk,
    input  logic               rst_n,
    input  logic [NUM_REQ-1:0] req_i,
    output logic [NUM_REQ-1:0] grant_o,
    output logic               grant_valid_o
);

  // ---------------------------------------------------------------------------
  // 参数派生与非法参数检查（DES-rra-001「参数」）
  // ---------------------------------------------------------------------------
  localparam int unsigned IDX_W = $clog2(NUM_REQ);
  localparam int unsigned LAST_IDX = NUM_REQ - 1;

  if (NUM_REQ < 2 || NUM_REQ > 8) begin : g_bad_param
    $error("rr_arbiter: NUM_REQ must be in [2, 8]");
  end

  // ---------------------------------------------------------------------------
  // 信号声明（后缀：_q 现态、_d 次态；与 DES-rra-001「实现规划」逐条一致）
  // ---------------------------------------------------------------------------
  logic [  IDX_W-1:0] ptr_q;
  logic [  IDX_W-1:0] ptr_d;
  logic [NUM_REQ-1:0] mask_lo;
  logic [NUM_REQ-1:0] req_hi;
  logic [  IDX_W-1:0] idx_hi;
  logic [  IDX_W-1:0] idx_lo;
  logic [  IDX_W-1:0] sel_idx;
  logic               wrap_hit;
  logic               hi_found;
  logic               lo_found;

  // ---------------------------------------------------------------------------
  // 段掩码 / 高段候选 / 授权有效 / 回绕标志：各一条 assign，一信号一条
  // ---------------------------------------------------------------------------
  assign mask_lo       = ~({NUM_REQ{1'b1}} << ptr_q);
  assign req_hi        = req_i & ~mask_lo;
  assign grant_valid_o = |req_i;
  assign wrap_hit      = ({{(32 - IDX_W) {1'b0}}, sel_idx} == LAST_IDX);

  // ---------------------------------------------------------------------------
  // 两段最低有效位优先编码：idx_hi / idx_lo 与扫描标志强关联，合在一个块
  // （从低位向高位扫描，命中第一个有效请求位即锁定）
  // ---------------------------------------------------------------------------
  always_comb begin
    idx_hi   = '0;
    idx_lo   = '0;
    hi_found = 1'b0;
    lo_found = 1'b0;
    for (int unsigned k = 0; k < NUM_REQ; k++) begin
      if (!lo_found && req_i[k]) begin
        idx_lo   = k[IDX_W-1:0];
        lo_found = 1'b1;
      end
      if (!hi_found && req_hi[k]) begin
        idx_hi   = k[IDX_W-1:0];
        hi_found = 1'b1;
      end
    end
  end

  // ---------------------------------------------------------------------------
  // 选择索引：高段有候选取高段（指针起点优先），否则回绕取 req_i 最低位
  // ---------------------------------------------------------------------------
  always_comb begin
    if (req_hi != {NUM_REQ{1'b0}}) begin
      sel_idx = idx_hi;
    end else begin
      sel_idx = idx_lo;
    end
  end

  // ---------------------------------------------------------------------------
  // 授权 one-hot 展开（组合透传；无授权时全 0）
  // ---------------------------------------------------------------------------
  always_comb begin
    if (grant_valid_o) begin
      grant_o = {{(NUM_REQ - 1) {1'b0}}, 1'b1} << sel_idx;
    end else begin
      grant_o = '0;
    end
  end

  // ---------------------------------------------------------------------------
  // 指针次态：有授权时推进到被授权者下一位，末位回绕到 0；无请求保持
  // ---------------------------------------------------------------------------
  always_comb begin
    ptr_d = ptr_q;
    if (grant_valid_o) begin
      if (wrap_hit) begin
        ptr_d = '0;
      end else begin
        ptr_d = sel_idx + {{(IDX_W - 1) {1'b0}}, 1'b1};
      end
    end
  end

  // ---------------------------------------------------------------------------
  // 时序逻辑：轮询指针（同步复位、低有效；只复位指针，不门控输出）
  // ---------------------------------------------------------------------------
  always_ff @(posedge clk) begin
    if (!rst_n) begin
      ptr_q <= '0;
    end else begin
      ptr_q <= ptr_d;
    end
  end

endmodule
