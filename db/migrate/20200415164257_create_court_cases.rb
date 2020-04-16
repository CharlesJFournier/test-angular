class CreateCourtCases < ActiveRecord::Migration[6.0]
  def change
    create_table :court_cases do |t|

      t.timestamps
    end
  end
end
